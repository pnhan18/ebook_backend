import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BooksModule } from '../books/books.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [QueueModule, PrismaModule, BooksModule, StorageModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule { }

