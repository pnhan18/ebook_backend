import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { connect, ChannelModel, Channel } from 'amqplib';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue('books', { durable: true });
    await this.channel.assertQueue('recommendations', { durable: true });
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }

  private sendCeleryTask(
    queue: string,
    taskName: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {},
  ): void {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const taskId = randomUUID();
    const message = JSON.stringify([args, kwargs, null]);

    this.channel.sendToQueue(queue, Buffer.from(message), {
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
    });
  }

  async publishBookProcessing(bookId: number, sourceKey: string): Promise<void> {
    this.sendCeleryTask('books', 'src.tasks.book_tasks.process_book', [bookId, sourceKey]);
  }

  async publishRecommendationTask(taskName: string, args: unknown[]): Promise<void> {
    this.sendCeleryTask('recommendations', `src.tasks.recommendation_tasks.${taskName}`, args);
  }

  async publishUserRecommendation(userId: number): Promise<void> {
    this.sendCeleryTask(
      'recommendations',
      'src.tasks.recommendation_tasks.compute_user_recommendation',
      [userId],
    );
  }
}
