import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AnalyticsController],
    providers: [
        AnalyticsService,
        {
            provide: 'IAnalyticsRepository',
            useClass: AnalyticsRepository,
        },
    ],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }
