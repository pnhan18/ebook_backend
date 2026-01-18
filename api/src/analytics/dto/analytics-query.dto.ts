import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AnalyticsPeriod {
    SEVEN_DAYS = '7d',
    THIRTY_DAYS = '30d',
    NINETY_DAYS = '90d',
}

export class AnalyticsQueryDto {
    @ApiPropertyOptional({
        enum: AnalyticsPeriod,
        default: AnalyticsPeriod.SEVEN_DAYS,
        description: 'Khoảng thời gian thống kê: 7d (7 ngày), 30d (30 ngày), 90d (3 tháng)',
    })
    @IsOptional()
    @IsEnum(AnalyticsPeriod)
    period?: AnalyticsPeriod = AnalyticsPeriod.SEVEN_DAYS;
}
