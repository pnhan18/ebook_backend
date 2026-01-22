import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { GoogleAnalyticsService } from './google-analytics.service';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule, ConfigModule],
    controllers: [AnalyticsController],
    providers: [
        AnalyticsService,
        GoogleAnalyticsService,
        {
            provide: 'IAnalyticsRepository',
            useClass: AnalyticsRepository,
        },
    ],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }

