import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IAnalyticsRepository, DateRevenue, DateUsers, DateViews } from '../interfaces/analytics-repository.interface';

@Injectable()
export class AnalyticsRepository implements IAnalyticsRepository {
    constructor(private readonly prisma: PrismaService) { }

    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    async getBookPurchasesRevenue(from: Date, to: Date): Promise<number> {
        const result = await this.prisma.payment.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                status: 'COMPLETED',
                createdAt: {
                    gte: from,
                    lt: to,
                },
            },
        });

        return Number(result._sum.amount || 0);
    }

    async getSubscriptionsRevenue(from: Date, to: Date): Promise<number> {
        const subscriptions = await this.prisma.subscription.findMany({
            where: {
                status: 'ACTIVE',
                currentPeriodStart: {
                    gte: from,
                    lt: to,
                },
            },
            select: {
                stripePriceId: true,
            },
        });

        if (subscriptions.length === 0) {
            return 0;
        }

        const priceIds = [...new Set(subscriptions.map((s) => s.stripePriceId))];
        const plans = await this.prisma.plan.findMany({
            where: {
                stripePriceId: { in: priceIds },
            },
            select: {
                stripePriceId: true,
                price: true,
            },
        });

        const priceMap = new Map(plans.map((p) => [p.stripePriceId, Number(p.price)]));

        return subscriptions.reduce((total, sub) => {
            const price = priceMap.get(sub.stripePriceId) || 0;
            return total + price;
        }, 0);
    }

    async getRevenueByDate(from: Date, to: Date): Promise<DateRevenue[]> {
        const bookPurchases = await this.prisma.$queryRaw<{ date: Date; total: number }[]>`
      SELECT DATE("createdAt") as date, COALESCE(SUM(amount), 0)::numeric as total
      FROM payments
      WHERE status = 'COMPLETED' AND "createdAt" >= ${from} AND "createdAt" < ${to}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

        const subscriptionsByDate = await this.prisma.$queryRaw<{ date: Date; price_id: string; count: bigint }[]>`
      SELECT DATE("currentPeriodStart") as date, "stripePriceId" as price_id, COUNT(*)::int as count
      FROM subscriptions
      WHERE status = 'ACTIVE' AND "currentPeriodStart" >= ${from} AND "currentPeriodStart" < ${to}
      GROUP BY DATE("currentPeriodStart"), "stripePriceId"
      ORDER BY date ASC
    `;

        const priceIds = [...new Set(subscriptionsByDate.map((s) => s.price_id))];
        const plans = await this.prisma.plan.findMany({
            where: { stripePriceId: { in: priceIds } },
            select: { stripePriceId: true, price: true },
        });
        const priceMap = new Map(plans.map((p) => [p.stripePriceId, Number(p.price)]));

        const dateMap = new Map<string, DateRevenue>();

        for (const bp of bookPurchases) {
            const dateStr = this.formatDate(bp.date);
            dateMap.set(dateStr, {
                date: dateStr,
                bookPurchases: Number(bp.total),
                subscriptions: 0,
            });
        }

        for (const sub of subscriptionsByDate) {
            const dateStr = this.formatDate(sub.date);
            const price = priceMap.get(sub.price_id) || 0;
            const revenue = price * Number(sub.count);

            if (dateMap.has(dateStr)) {
                dateMap.get(dateStr)!.subscriptions += revenue;
            } else {
                dateMap.set(dateStr, {
                    date: dateStr,
                    bookPurchases: 0,
                    subscriptions: revenue,
                });
            }
        }

        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    async getNewUsersCount(from: Date, to: Date): Promise<number> {
        return this.prisma.user.count({
            where: {
                createdAt: {
                    gte: from,
                    lt: to,
                },
            },
        });
    }

    async getNewUsersByDate(from: Date, to: Date): Promise<DateUsers[]> {
        const result = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
            SELECT DATE("createdAt") as date, COUNT(*)::int as count
            FROM users
            WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `;

        return result.map((row) => ({
            date: this.formatDate(row.date),
            newUsers: Number(row.count),
        }));
    }

    async getViewsCount(from: Date, to: Date): Promise<number> {
        return this.prisma.bookView.count({
            where: {
                viewedAt: {
                    gte: from,
                    lt: to,
                },
            },
        });
    }

    async getViewsByDate(from: Date, to: Date): Promise<DateViews[]> {
        const result = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
            SELECT DATE("viewedAt") as date, COUNT(*)::int as count
            FROM book_views
            WHERE "viewedAt" >= ${from} AND "viewedAt" < ${to}
            GROUP BY DATE("viewedAt")
            ORDER BY date ASC
        `;

        return result.map((row) => ({
            date: this.formatDate(row.date),
            views: Number(row.count),
        }));
    }
}

