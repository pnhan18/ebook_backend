import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IAnalyticsRepository, DateRevenue } from '../interfaces/analytics-repository.interface';

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
      SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0)::numeric as total
      FROM payments
      WHERE status = 'COMPLETED' AND created_at >= ${from} AND created_at < ${to}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

        const subscriptionsByDate = await this.prisma.$queryRaw<{ date: Date; price_id: string; count: bigint }[]>`
      SELECT DATE(current_period_start) as date, stripe_price_id as price_id, COUNT(*)::int as count
      FROM subscriptions
      WHERE status = 'ACTIVE' AND current_period_start >= ${from} AND current_period_start < ${to}
      GROUP BY DATE(current_period_start), stripe_price_id
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
}
