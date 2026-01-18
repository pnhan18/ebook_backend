import { Injectable, Inject } from '@nestjs/common';
import { AnalyticsPeriod, AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';
import type { IAnalyticsRepository } from './interfaces/analytics-repository.interface';

@Injectable()
export class AnalyticsService {
    constructor(
        @Inject('IAnalyticsRepository')
        private readonly analyticsRepository: IAnalyticsRepository,
    ) { }

    private getDateRanges(period: AnalyticsPeriod): {
        current: { from: Date; to: Date };
        previous: { from: Date; to: Date };
    } {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        let days: number;
        switch (period) {
            case AnalyticsPeriod.THIRTY_DAYS:
                days = 30;
                break;
            case AnalyticsPeriod.NINETY_DAYS:
                days = 90;
                break;
            case AnalyticsPeriod.SEVEN_DAYS:
            default:
                days = 7;
        }

        const currentFrom = new Date(today);
        currentFrom.setDate(currentFrom.getDate() - days + 1);
        currentFrom.setHours(0, 0, 0, 0);

        const currentTo = new Date(today);
        currentTo.setDate(currentTo.getDate() + 1);
        currentTo.setHours(0, 0, 0, 0);

        const previousFrom = new Date(currentFrom);
        previousFrom.setDate(previousFrom.getDate() - days);

        const previousTo = new Date(currentFrom);

        return {
            current: { from: currentFrom, to: currentTo },
            previous: { from: previousFrom, to: previousTo },
        };
    }

    private calculateGrowthRate(current: number, previous: number): number {
        if (previous === 0) {
            return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    }

    async getAnalytics(query: AnalyticsQueryDto): Promise<AnalyticsResponseDto> {
        const period = query.period || AnalyticsPeriod.SEVEN_DAYS;
        const { current, previous } = this.getDateRanges(period);

        const [
            currentBookRevenue,
            previousBookRevenue,
            currentSubRevenue,
            previousSubRevenue,
            currentRevenueByDate,
        ] = await Promise.all([
            this.analyticsRepository.getBookPurchasesRevenue(current.from, current.to),
            this.analyticsRepository.getBookPurchasesRevenue(previous.from, previous.to),
            this.analyticsRepository.getSubscriptionsRevenue(current.from, current.to),
            this.analyticsRepository.getSubscriptionsRevenue(previous.from, previous.to),
            this.analyticsRepository.getRevenueByDate(current.from, current.to),
        ]);

        const currentTotal = currentBookRevenue + currentSubRevenue;
        const previousTotal = previousBookRevenue + previousSubRevenue;

        return {
            period,
            dateRange: {
                from: current.from.toISOString().split('T')[0],
                to: new Date(current.to.getTime() - 1).toISOString().split('T')[0],
            },
            current: currentTotal,
            previous: previousTotal,
            growthRate: this.calculateGrowthRate(currentTotal, previousTotal),
            breakdown: {
                bookPurchases: currentBookRevenue,
                subscriptions: currentSubRevenue,
            },
            byDate: currentRevenueByDate,
        };
    }
}
