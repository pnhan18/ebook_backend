import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { randomUUID } from 'crypto';

@Injectable()
export class QueueService {
    constructor(private readonly amqpConnection: AmqpConnection) { }

    private async sendCeleryTask(
        queue: string,
        taskName: string,
        args: any[] = [],
        kwargs: Record<string, any> = {},
    ) {
        const taskId = randomUUID();

        // Celery message body format: [args, kwargs, embed]
        // Don't stringify - let amqp library handle serialization
        const body = [args, kwargs, null];

        // Celery requires specific headers and content type
        const options = {
            persistent: true,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
            headers: {
                task: taskName,
                id: taskId,
                lang: 'py',
                root_id: taskId,
                parent_id: null,
                group: null,
            },
        };

        await this.amqpConnection.publish('', queue, body, options);
    }

    async publishBookProcessing(bookId: number, sourceKey: string) {
        await this.sendCeleryTask(
            'books',
            'src.tasks.book_tasks.process_book',
            [],
            { book_id: bookId, source_key: sourceKey },
        );
    }

    async publishAudioGeneration(chapterId: number) {
        await this.sendCeleryTask(
            'audio',
            'generate_chapter_audio',
            [chapterId],
            {},
        );
    }
}
