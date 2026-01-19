import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AudioService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly queueService: QueueService,
        private readonly storageService: StorageService,
    ) { }

    async generateAudio(chapterId: number) {
        // 1. Kiểm tra chapter tồn tại
        const chapter = await this.prisma.chapter.findUnique({
            where: { id: chapterId },
            include: { audio: true },
        });

        if (!chapter) {
            throw new NotFoundException('Chapter not found');
        }

        // 2. Kiểm tra Audio đã tồn tại chưa
        if (chapter.audio) {
            if (chapter.audio.status === 'COMPLETED') {
                return { message: 'Audio already exists', audio: chapter.audio };
            }
            if (chapter.audio.status === 'PROCESSING' || chapter.audio.status === 'PENDING') {
                return { message: 'Audio is being processed', audio: chapter.audio };
            }
        }

        // 3. Tạo hoặc update Audio record thành PENDING
        let audio;
        if (chapter.audio) {
            audio = await this.prisma.audio.update({
                where: { id: chapter.audio.id },
                data: { status: 'PENDING', error: null },
            });
        } else {
            audio = await this.prisma.audio.create({
                data: {
                    chapterId: chapter.id,
                    status: 'PENDING',
                },
            });
        }

        await this.queueService.publishAudioGeneration(chapterId);

        return { message: 'Audio generation started', audio };
    }

    async getChapterAudio(chapterId: number) {
        const audio = await this.prisma.audio.findUnique({
            where: { chapterId },
        });

        if (!audio) {
            throw new NotFoundException('Audio not found for this chapter');
        }

        if (audio.status !== 'COMPLETED' || !audio.audioKey) {
            return {
                id: audio.id,
                chapterId: audio.chapterId,
                status: audio.status,
                error: audio.error,
                url: null,
            };
        }

        const url = await this.storageService.getPresignedDownloadUrl(audio.audioKey);

        return {
            id: audio.id,
            chapterId: audio.chapterId,
            status: audio.status,
            url,
            duration: audio.duration,
        };
    }
}
