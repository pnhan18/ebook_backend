import { Injectable, Inject } from '@nestjs/common';
import { AnalyticsPeriod, AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';
import type { IAnalyticsRepository } from './interfaces/analytics-repository.interface';
import { GoogleAnalyticsService } from './google-analytics.service';
import { CacheService } from '../cache/cache.service';
import { CacheTTL } from '../cache/cache.constants';

@Injectable()
export class AnalyticsService {
    constructor(
        @Inject('IAnalyticsRepository')
        private readonly analyticsRepository: IAnalyticsRepository,
        private readonly googleAnalyticsService: GoogleAnalyticsService,
        private readonly cacheService: CacheService,
    ) { }

    private getPeriodDays(period: AnalyticsPeriod): number {
        switch (period) {
            case AnalyticsPeriod.THIRTY_DAYS:
                return 30;
            case AnalyticsPeriod.NINETY_DAYS:
                return 90;
            case AnalyticsPeriod.SEVEN_DAYS:
            default:
                return 7;
        }
    }

    private getDateRanges(period: AnalyticsPeriod): {
        current: { from: Date; to: Date };
        previous: { from: Date; to: Date };
    } {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const days = this.getPeriodDays(period);

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
        const cacheKey = this.cacheService.analyticsKey(period);

        return this.cacheService.wrap(
            cacheKey,
            async () => {
                const days = this.getPeriodDays(period);
                const { current, previous } = this.getDateRanges(period);

                // Fetch all data in parallel (including Google Analytics)
                const [
                    // Revenue
                    currentBookRevenue,
                    previousBookRevenue,
                    currentSubRevenue,
                    previousSubRevenue,
                    currentRevenueByDate,
                    // New Users
                    currentNewUsers,
                    previousNewUsers,
                    currentNewUsersByDate,
                    // Views
                    currentViews,
                    previousViews,
                    currentViewsByDate,
                    // Active Users (from Google Analytics)
                    gaActiveUsers,
                    gaActiveUsersByDate,
                ] = await Promise.all([
                    // Revenue
                    this.analyticsRepository.getBookPurchasesRevenue(current.from, current.to),
                    this.analyticsRepository.getBookPurchasesRevenue(previous.from, previous.to),
                    this.analyticsRepository.getSubscriptionsRevenue(current.from, current.to),
                    this.analyticsRepository.getSubscriptionsRevenue(previous.from, previous.to),
                    this.analyticsRepository.getRevenueByDate(current.from, current.to),
                    // New Users
                    this.analyticsRepository.getNewUsersCount(current.from, current.to),
                    this.analyticsRepository.getNewUsersCount(previous.from, previous.to),
                    this.analyticsRepository.getNewUsersByDate(current.from, current.to),
                    // Views
                    this.analyticsRepository.getViewsCount(current.from, current.to),
                    this.analyticsRepository.getViewsCount(previous.from, previous.to),
                    this.analyticsRepository.getViewsByDate(current.from, current.to),
                    // Active Users (from Google Analytics)
                    this.googleAnalyticsService.getActiveUsers(days),
                    this.googleAnalyticsService.getActiveUsersByDate(days),
                ]);

                const currentTotalRevenue = currentBookRevenue + currentSubRevenue;
                const previousTotalRevenue = previousBookRevenue + previousSubRevenue;

                const result: AnalyticsResponseDto = {
                    period,
                    dateRange: {
                        from: current.from.toISOString().split('T')[0],
                        to: new Date(current.to.getTime() - 1).toISOString().split('T')[0],
                    },
                    // Revenue
                    revenue: {
                        current: currentTotalRevenue,
                        previous: previousTotalRevenue,
                        growthRate: this.calculateGrowthRate(currentTotalRevenue, previousTotalRevenue),
                    },
                    revenueBreakdown: {
                        bookPurchases: currentBookRevenue,
                        subscriptions: currentSubRevenue,
                    },
                    revenueByDate: currentRevenueByDate,
                    // New Users
                    newUsers: {
                        current: currentNewUsers,
                        previous: previousNewUsers,
                        growthRate: this.calculateGrowthRate(currentNewUsers, previousNewUsers),
                    },
                    newUsersByDate: currentNewUsersByDate,
                    // Views
                    views: {
                        current: currentViews,
                        previous: previousViews,
                        growthRate: this.calculateGrowthRate(currentViews, previousViews),
                    },
                    viewsByDate: currentViewsByDate,
                };

                // Add Google Analytics data if configured
                if (this.googleAnalyticsService.isConfigured()) {
                    result.activeUsers = gaActiveUsers;
                    result.activeUsersByDate = gaActiveUsersByDate;
                }

                return result;
            },
            { ttl: CacheTTL.ANALYTICS_OVERVIEW },
        );
    }
}


