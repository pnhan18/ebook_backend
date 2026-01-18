export type Period = '7d' | '30d' | '90d';

export interface DateRevenue {
    date: string;
    bookPurchases: number;
    subscriptions: number;
}

export interface IAnalyticsRepository {
    /**
     * Get completed book purchases revenue for a date range
     */
    getBookPurchasesRevenue(from: Date, to: Date): Promise<number>;

    /**
     * Get subscription revenue for a date range
     */
    getSubscriptionsRevenue(from: Date, to: Date): Promise<number>;

    /**
     * Get revenue grouped by date
     */
    getRevenueByDate(from: Date, to: Date): Promise<DateRevenue[]>;
}
