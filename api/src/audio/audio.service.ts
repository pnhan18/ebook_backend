import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { PassThrough } from 'stream';
import * as cheerio from 'cheerio';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

interface CachedAudioResponse {
    type: 'redirect';
    url: string;
}

interface StreamAudioResponse {
    type: 'stream';
    contentType: string;
    stream: NodeJS.ReadableStream;
}

@Injectable()
export class AudioService {
    private readonly logger = new Logger(AudioService.name);
    private readonly azureSpeechKey: string;
    private readonly azureSpeechRegion: string;
    private readonly azureVoiceName: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly configService: ConfigService,
        private readonly queueService: QueueService,
    ) {
        this.azureSpeechKey = this.configService.get<string>('AZURE_SPEECH_KEY') ?? '';
        this.azureSpeechRegion = this.configService.get<string>('AZURE_SPEECH_REGION') ?? '';
        this.azureVoiceName = this.configService.get<string>('AZURE_VOICE_NAME', 'vi-VN-NamMinhNeural');
    }

    async generateAudio(chapterId: number) {
        const chapter = await this.prisma.chapter.findUnique({
            where: { id: chapterId },
        });

        if (!chapter) {
            throw new NotFoundException('Chapter not found');
        }

        await this.queueService.publishAudioGeneration(chapterId);
        return { message: 'Audio generation started' };
    }

    async clearAudioCache(chapterId: number) {
        const chapter = await this.prisma.chapter.findUnique({
            where: { id: chapterId },
            include: { audio: true },
        });

        if (chapter?.audio) {
            // Delete from S3
            if (chapter.audio.audioKey) {
                try {
                    await this.storageService.deleteObject(chapter.audio.audioKey);
                } catch (e) {
                    this.logger.warn(`Failed to delete audio from storage: ${e}`);
                }
            }

            // Delete from DB
            await this.prisma.audio.delete({
                where: { chapterId },
            });

            return { message: 'Audio cache cleared' };
        }

        return { message: 'No audio cache found' };
    }

    async getChapterAudio(chapterId: number): Promise<CachedAudioResponse | StreamAudioResponse> {
        const chapter = await this.prisma.chapter.findUnique({
            where: { id: chapterId },
            include: { audio: true },
        });

        if (!chapter) {
            throw new NotFoundException('Chapter not found');
        }

        // 2. Nếu audio đã có trong DB và COMPLETED → trả về URL
        if (chapter.audio && chapter.audio.status === 'COMPLETED' && chapter.audio.audioKey) {
            const url = await this.storageService.getPresignedDownloadUrl(chapter.audio.audioKey);
            return {
                type: 'redirect',
                url,
            };
        }

        // 3. Không có audio → Stream từ Azure TTS
        if (!chapter.contentKey) {
            throw new NotFoundException('Chapter content not found');
        }

        // Download chapter content từ S3
        let htmlContent = '';
        try {
            const htmlBuffer = await this.storageService.getObject(chapter.contentKey);
            htmlContent = htmlBuffer.toString('utf-8');
        } catch (error) {
            this.logger.error(`Failed to download chapter content: ${error}`);
            throw new NotFoundException('Could not retrieve chapter content');
        }

        // Parse HTML lấy text
        const $ = cheerio.load(htmlContent);
        const paragraphs = $('p')
            .map((_, el) => $(el).text().trim())
            .get()
            .filter(text => text.length > 0);

        if (paragraphs.length === 0) {
            const text = $.root().text().trim();
            if (!text) {
                throw new NotFoundException('No text content found in chapter');
            }
            paragraphs.push(text);
        }

        // Tạo audio key dự kiến để lưu cache
        const audioKey = chapter.contentKey.replace('chapters/', 'audios/').replace('.html', '.mp3');

        this.logger.log(`🎵 Starting audio stream for chapter ${chapterId} with ${paragraphs.length} paragraphs`);
        
        // Stream từng đoạn để giảm latency
        const stream = this.streamFromAzureTTSChunked(paragraphs, chapterId, audioKey);

        return {
            type: 'stream',
            contentType: 'audio/mpeg',
            stream,
        };
    }

    /**
     * Stream audio từ Azure TTS theo chunks (paragraphs) để giảm latency
     */
    private streamFromAzureTTSChunked(paragraphs: string[], chapterId: number, audioKey: string): NodeJS.ReadableStream {
        if (!this.azureSpeechKey || !this.azureSpeechRegion) {
            throw new Error('Azure Speech credentials not configured');
        }

        const passThrough = new PassThrough();
        const audioChunks: Buffer[] = [];
        let currentIndex = 0;
        let isClientDisconnected = false;
        let currentSynthesizer: sdk.SpeechSynthesizer | null = null;
        let lastWriteTime = Date.now();
        let writeCheckInterval: NodeJS.Timeout | null = null;

        // Listen for stream events
        passThrough.on('close', () => {
            // Cleanup only, don't log as disconnect here
            if (writeCheckInterval) {
                clearInterval(writeCheckInterval);
                writeCheckInterval = null;
            }
        });

        passThrough.on('error', (err) => {
            this.logger.error(`Stream error for chapter ${chapterId}: ${err.message}`);
            isClientDisconnected = true;
            if (currentSynthesizer) {
                currentSynthesizer.close();
                currentSynthesizer = null;
            }
            if (writeCheckInterval) {
                clearInterval(writeCheckInterval);
                writeCheckInterval = null;
            }
        });

        // Check if client is still consuming data (detect pause/stop)
        writeCheckInterval = setInterval(() => {
            const timeSinceLastWrite = Date.now() - lastWriteTime;
            // Nếu không write được data trong 30 giây → client đã pause/stop quá lâu
            if (timeSinceLastWrite > 30000 && currentIndex < paragraphs.length) {
                this.logger.log(`⏸️ Client stopped consuming data for chapter ${chapterId} (${Math.round(timeSinceLastWrite/1000)}s) - stopping synthesis`);
                isClientDisconnected = true;
                if (currentSynthesizer) {
                    currentSynthesizer.close();
                    currentSynthesizer = null;
                }
                if (writeCheckInterval) {
                    clearInterval(writeCheckInterval);
                    writeCheckInterval = null;
                }
                passThrough.destroy();
            }
        }, 5000);

        const processNextParagraph = async () => {
            if (isClientDisconnected || currentIndex >= paragraphs.length) {
                if (!isClientDisconnected && currentIndex >= paragraphs.length) {
                    // Hoàn thành tất cả paragraphs
                    if (writeCheckInterval) {
                        clearInterval(writeCheckInterval);
                        writeCheckInterval = null;
                    }
                    passThrough.end();
                    this.logger.log(`✅ Completed streaming ${paragraphs.length} paragraphs for chapter ${chapterId}`);
                    
                    // Save to cache
                    this.saveAudioToStorage(chapterId, audioKey, Buffer.concat(audioChunks));
                } else if (isClientDisconnected) {
                    this.logger.log(`🛑 Stopped streaming at paragraph ${currentIndex}/${paragraphs.length} - not saving to cache`);
                    if (writeCheckInterval) {
                        clearInterval(writeCheckInterval);
                        writeCheckInterval = null;
                    }
                }
                return;
            }

            const text = paragraphs[currentIndex];
            currentIndex++;

            this.logger.debug(`Streaming paragraph ${currentIndex}/${paragraphs.length} for chapter ${chapterId}`);

            const speechConfig = sdk.SpeechConfig.fromSubscription(this.azureSpeechKey, this.azureSpeechRegion);
            speechConfig.speechSynthesisVoiceName = this.azureVoiceName;
            speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

            const pushStream = sdk.AudioOutputStream.createPullStream();
            const audioConfig = sdk.AudioConfig.fromStreamOutput(pushStream);
            const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
            currentSynthesizer = synthesizer;

            synthesizer.speakTextAsync(
                text,
                (result) => {
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                        this.logger.debug(`Paragraph ${currentIndex} completed`);
                    } else {
                        this.logger.error(`Azure TTS synthesis canceled: ${result.errorDetails}`);
                        if (!passThrough.destroyed) {
                            passThrough.emit('error', new Error(result.errorDetails));
                        }
                        isClientDisconnected = true;
                    }
                    synthesizer.close();
                    currentSynthesizer = null;
                },
                (error) => {
                    this.logger.error(`Azure TTS error: ${error}`);
                    if (!passThrough.destroyed) {
                        passThrough.emit('error', error);
                    }
                    isClientDisconnected = true;
                    synthesizer.close();
                    currentSynthesizer = null;
                }
            );

            // Read from Azure PullStream
            const buffer = new ArrayBuffer(4096);
            const readData = async () => {
                try {
                    if (passThrough.destroyed || isClientDisconnected) {
                        isClientDisconnected = true;
                        pushStream.close();
                        if (currentSynthesizer) {
                            currentSynthesizer.close();
                            currentSynthesizer = null;
                        }
                        return;
                    }

                    const bytesRead = await pushStream.read(buffer);
                    if (bytesRead > 0) {
                        const chunk = Buffer.from(buffer.slice(0, bytesRead));

                        try {
                            if (!passThrough.destroyed) {
                                const canWrite = passThrough.write(chunk);
                                lastWriteTime = Date.now(); // Update last write time
                                
                                // Nếu buffer đầy, đợi drain event
                                if (!canWrite) {
                                    await new Promise(resolve => passThrough.once('drain', resolve));
                                }
                            } else {
                                throw new Error('Stream destroyed');
                            }
                        } catch (writeError) {
                            isClientDisconnected = true;
                            pushStream.close();
                            if (currentSynthesizer) {
                                currentSynthesizer.close();
                                currentSynthesizer = null;
                            }
                            return;
                        }

                        audioChunks.push(chunk);
                        setImmediate(readData);
                    } else {
                        // End of current paragraph
                        pushStream.close();
                        currentSynthesizer = null;
                        
                        // Process next paragraph
                        if (!isClientDisconnected) {
                            setImmediate(processNextParagraph);
                        }
                    }
                } catch (error) {
                    this.logger.error(`Error reading from Azure stream: ${error}`);
                    if (!passThrough.destroyed) {
                        passThrough.emit('error', error);
                    }
                    isClientDisconnected = true;
                    pushStream.close();
                    if (currentSynthesizer) {
                        currentSynthesizer.close();
                        currentSynthesizer = null;
                    }
                }
            };

            readData();
        };

        // Start processing first paragraph
        processNextParagraph();

        return passThrough;
    }

    /**
     * Stream audio từ Azure TTS và lưu cache
     */
    private streamFromAzureTTS(text: string, chapterId: number, audioKey: string): NodeJS.ReadableStream {
        if (!this.azureSpeechKey || !this.azureSpeechRegion) {
            throw new Error('Azure Speech credentials not configured');
        }

        const startTime = Date.now();
        this.logger.log(`⏱️  Azure TTS synthesis started for chapter ${chapterId}`);

        const passThrough = new PassThrough();
        const audioChunks: Buffer[] = []; // Buffer để gom data upload S3

        const speechConfig = sdk.SpeechConfig.fromSubscription(this.azureSpeechKey, this.azureSpeechRegion);
        speechConfig.speechSynthesisVoiceName = this.azureVoiceName;
        speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

        // Create a push stream to receive audio data
        const pushStream = sdk.AudioOutputStream.createPullStream();

        // Configure audio output to write to our push stream
        const audioConfig = sdk.AudioConfig.fromStreamOutput(pushStream);

        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

        // Start synthesis
        synthesizer.speakTextAsync(
            text,
            (result) => {
                if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                    this.logger.log('Azure TTS synthesis completed.');
                } else {
                    this.logger.error(`Azure TTS synthesis canceled: ${result.errorDetails}`);
                    if (!passThrough.destroyed) {
                        passThrough.emit('error', new Error(result.errorDetails));
                    }
                }
                synthesizer.close();
            },
            (error) => {
                this.logger.error(`Azure TTS error: ${error}`);
                if (!passThrough.destroyed) {
                    passThrough.emit('error', error);
                }
                synthesizer.close();
            }
        );

        // Read from Azure PullStream and write to our PassThrough stream
        const buffer = new ArrayBuffer(4096);
        const readData = async () => {
            try {
                if (passThrough.destroyed) {
                    this.logger.debug(`Client disconnected, aborting audio generation...`);
                    pushStream.close();
                    synthesizer.close();
                    return;
                }

                const bytesRead = await pushStream.read(buffer);
                if (bytesRead > 0) {
                    const chunk = Buffer.from(buffer.slice(0, bytesRead));

                    // 1. Gửi cho client
                    try {
                        if (!passThrough.destroyed) {
                            passThrough.write(chunk);
                        } else {
                            throw new Error('Stream destroyed');
                        }
                    } catch (writeError) {
                        // Client disconnected, abort
                        this.logger.debug(`Client disconnected during write, aborting audio generation...`);
                        pushStream.close();
                        synthesizer.close();
                        return;
                    }

                    // 2. Lưu vào buffer để cache
                    audioChunks.push(chunk);

                    // Continue reading
                    setImmediate(readData);
                } else {
                    // End of stream
                    if (!passThrough.destroyed) {
                        passThrough.end();

                        // 3. Trigger background upload sau khi stream xong
                        // Only save if client stayed connected until the end (complete audio)
                        this.saveAudioToStorage(chapterId, audioKey, Buffer.concat(audioChunks));
                    } else {
                        this.logger.debug(`Client disconnected before stream completion, skipping cache save`);
                    }
                    pushStream.close();
                }
            } catch (error) {
                this.logger.error(`Error reading from Azure stream: ${error}`);
                if (!passThrough.destroyed) {
                    passThrough.emit('error', error);
                }
                pushStream.close();
            }
        };

        // Start reading loop
        readData();

        return passThrough;
    }

    /**
     * Background task: Upload audio to S3 and update DB
     */
    private async saveAudioToStorage(chapterId: number, key: string, buffer: Buffer) {
        this.logger.log(`Starting background upload for chapter ${chapterId}...`);
        try {
            // 1. Upload to S3
            const { uploadUrl } = await this.storageService.getPresignedUploadUrl('audios', 'temp.mp3'); // Hacky way to get upload url if needed, but we use putObject directly usually
            // Actually storageService doesn't expose putObject directly for public use easily, 
            // let's assume we can use a method to upload buffer directly. 
            // Wait, storageService currently only has getPresignedUploadUrl.
            // I need to add a method to upload buffer directly in StorageService or use the S3 client directly if I could.
            // But StorageService has s3Client private.
            // Let's check StorageService again. It has getObject but not putObject public.
            // I will use a workaround or update StorageService. 
            // For now, I'll assume I can add `uploadObject` to StorageService.

            // NOTE: I need to update StorageService to support direct buffer upload.
            // For now, I will assume it exists and I will update StorageService next.
            await this.storageService.uploadObject(key, buffer, 'audio/mpeg');

            // 2. Calculate duration (approximate for MP3 32kbps)
            // Bitrate = 32 kbps = 32000 bits/s = 4000 bytes/s
            const duration = Math.round(buffer.length / 4000);

            // 3. Update/Create Audio record in DB
            await this.prisma.audio.upsert({
                where: { chapterId },
                update: {
                    status: 'COMPLETED',
                    audioKey: key,
                    duration: duration,
                    error: null,
                },
                create: {
                    chapterId,
                    status: 'COMPLETED',
                    audioKey: key,
                    duration: duration,
                },
            });

            this.logger.log(`✅ Audio cached successfully for chapter ${chapterId}`);
        } catch (error) {
            this.logger.error(`Failed to cache audio for chapter ${chapterId}: ${error}`);
        }
    }
}
