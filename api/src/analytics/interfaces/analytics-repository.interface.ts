export type Period = '7d' | '30d' | '90d';

export interface DateRevenue {
    date: string;
    bookPurchases: number;
    subscriptions: number;
}

export interface DateUsers {
    date: string;
    newUsers: number;
}

export interface DateViews {
    date: string;
    views: number;
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

    /**
     * Get new users count for a date range
     */
    getNewUsersCount(from: Date, to: Date): Promise<number>;

    /**
     * Get new users grouped by date
     */
    getNewUsersByDate(from: Date, to: Date): Promise<DateUsers[]>;

    /**
     * Get views count for a date range
     */
    getViewsCount(from: Date, to: Date): Promise<number>;

    /**
     * Get views grouped by date
     */
    getViewsByDate(from: Date, to: Date): Promise<DateViews[]>;
}
