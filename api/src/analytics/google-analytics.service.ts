import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export interface GAActiveUsersResult {
    current: number;
    previous: number;
    growthRate: number;
}

export interface GAActiveUsersByDate {
    date: string;
    activeUsers: number;
}

@Injectable()
export class GoogleAnalyticsService implements OnModuleInit {
    private readonly logger = new Logger(GoogleAnalyticsService.name);
    private client: BetaAnalyticsDataClient | null = null;
    private propertyId: string;
    private isEnabled = false;

    constructor(private readonly configService: ConfigService) {
        this.propertyId = this.configService.get<string>('GA_PROPERTY_ID') || '';
    }

    async onModuleInit() {
        const credentialsJson = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS_JSON');

        if (!this.propertyId) {
            this.logger.warn('GA_PROPERTY_ID not configured. Google Analytics integration disabled.');
            return;
        }

        try {
            if (credentialsJson) {
                // Parse JSON credentials from environment variable
                const credentials = JSON.parse(credentialsJson);
                this.client = new BetaAnalyticsDataClient({ credentials });
            } else {
                // Use default credentials (from GOOGLE_APPLICATION_CREDENTIALS file path)
                this.client = new BetaAnalyticsDataClient();
            }
            this.isEnabled = true;
            this.logger.log('✅ Google Analytics client initialized');
        } catch (error) {
            this.logger.error('Failed to initialize Google Analytics client:', error);
        }
    }

    private calculateGrowthRate(current: number, previous: number): number {
        if (previous === 0) {
            return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    }

    private formatDateRange(days: number): { current: { from: string; to: string }; previous: { from: string; to: string } } {
        const today = new Date();
        const currentTo = today.toISOString().split('T')[0];

        const currentFrom = new Date(today);
        currentFrom.setDate(currentFrom.getDate() - days + 1);

        const previousTo = new Date(currentFrom);
        previousTo.setDate(previousTo.getDate() - 1);

        const previousFrom = new Date(previousTo);
        previousFrom.setDate(previousFrom.getDate() - days + 1);

        return {
            current: {
                from: currentFrom.toISOString().split('T')[0],
                to: currentTo,
            },
            previous: {
                from: previousFrom.toISOString().split('T')[0],
                to: previousTo.toISOString().split('T')[0],
            },
        };
    }

    async getActiveUsers(days: number = 7): Promise<GAActiveUsersResult> {
        if (!this.isEnabled || !this.client) {
            return { current: 0, previous: 0, growthRate: 0 };
        }

        const { current, previous } = this.formatDateRange(days);

        try {
            // Get current period active users
            const [currentResponse] = await this.client.runReport({
                property: `properties/${this.propertyId}`,
                dateRanges: [{ startDate: current.from, endDate: current.to }],
                metrics: [{ name: 'activeUsers' }],
            });

            // Get previous period active users
            const [previousResponse] = await this.client.runReport({
                property: `properties/${this.propertyId}`,
                dateRanges: [{ startDate: previous.from, endDate: previous.to }],
                metrics: [{ name: 'activeUsers' }],
            });

            const currentValue = parseInt(currentResponse.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
            const previousValue = parseInt(previousResponse.rows?.[0]?.metricValues?.[0]?.value || '0', 10);

            return {
                current: currentValue,
                previous: previousValue,
                growthRate: this.calculateGrowthRate(currentValue, previousValue),
            };
        } catch (error) {
            this.logger.error('Failed to fetch active users from GA:', error);
            return { current: 0, previous: 0, growthRate: 0 };
        }
    }

    async getActiveUsersByDate(days: number = 7): Promise<GAActiveUsersByDate[]> {
        if (!this.isEnabled || !this.client) {
            return [];
        }

        const { current } = this.formatDateRange(days);

        try {
            const [response] = await this.client.runReport({
                property: `properties/${this.propertyId}`,
                dateRanges: [{ startDate: current.from, endDate: current.to }],
                dimensions: [{ name: 'date' }],
                metrics: [{ name: 'activeUsers' }],
                orderBys: [{ dimension: { dimensionName: 'date' } }],
            });

            return (response.rows || []).map((row) => ({
                date: this.formatGADate(row.dimensionValues?.[0]?.value || ''),
                activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
            }));
        } catch (error) {
            this.logger.error('Failed to fetch active users by date from GA:', error);
            return [];
        }
    }

    private formatGADate(gaDate: string): string {
        // GA returns date as YYYYMMDD, convert to YYYY-MM-DD
        if (gaDate.length === 8) {
            return `${gaDate.slice(0, 4)}-${gaDate.slice(4, 6)}-${gaDate.slice(6, 8)}`;
        }
        return gaDate;
    }

    isConfigured(): boolean {
        return this.isEnabled;
    }
}
