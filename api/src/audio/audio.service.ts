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
        this.azureVoiceName = this.configService.get<string>('AZURE_VOICE_NAME', 'en-US-JennyNeural');
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

        // Gọi Azure TTS streaming và cache
        const textToSpeak = paragraphs.join('\n\n');

        // Tạo audio key dự kiến để lưu cache
        const audioKey = chapter.contentKey.replace('chapters/', 'audios/').replace('.html', '.mp3');

        const stream = this.streamFromAzureTTS(textToSpeak, chapterId, audioKey);

        return {
            type: 'stream',
            contentType: 'audio/mpeg',
            stream,
        };
    }

    /**
     * Stream audio từ Azure TTS và lưu cache
     */
    private streamFromAzureTTS(text: string, chapterId: number, audioKey: string): NodeJS.ReadableStream {
        if (!this.azureSpeechKey || !this.azureSpeechRegion) {
            throw new Error('Azure Speech credentials not configured');
        }

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
                    passThrough.emit('error', new Error(result.errorDetails));
                }
                synthesizer.close();
            },
            (error) => {
                this.logger.error(`Azure TTS error: ${error}`);
                passThrough.emit('error', error);
                synthesizer.close();
            }
        );

        // Read from Azure PullStream and write to our PassThrough stream
        const buffer = new ArrayBuffer(4096);
        const readData = async () => {
            try {
                const bytesRead = await pushStream.read(buffer);
                if (bytesRead > 0) {
                    const chunk = Buffer.from(buffer.slice(0, bytesRead));

                    // 1. Gửi cho client
                    try {
                        if (!passThrough.destroyed) {
                            passThrough.write(chunk);
                        }
                    } catch (writeError) {
                        // Client disconnected, ignore error and continue caching
                        this.logger.debug(`Client disconnected, continuing to cache audio...`);
                    }

                    // 2. Lưu vào buffer để cache
                    audioChunks.push(chunk);

                    // Continue reading
                    setImmediate(readData);
                } else {
                    // End of stream
                    if (!passThrough.destroyed) {
                        passThrough.end();
                    }
                    pushStream.close();

                    // 3. Trigger background upload sau khi stream xong
                    this.saveAudioToStorage(chapterId, audioKey, Buffer.concat(audioChunks));
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
