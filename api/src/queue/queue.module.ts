import { Module, Global } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672',
        connectionInitOptions: { wait: false },
        exchanges: [
          {
            name: 'ebook_exchange',
            type: 'topic',
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule { }
