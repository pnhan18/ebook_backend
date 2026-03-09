import { Module } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { RatingsRepository } from './repositories/ratings.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RatingsController],
  providers: [
    RatingsService,
    {
      provide: 'IRatingsRepository',
      useClass: RatingsRepository,
    },
  ],
  exports: [RatingsService],
})
export class RatingsModule {}
