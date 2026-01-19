import { Injectable } from '@nestjs/common';
import { Promotion, Prisma, PromotionScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IPromotionRepository } from '../interfaces';

@Injectable()
export class PromotionRepository implements IPromotionRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: Prisma.PromotionCreateInput): Promise<Promotion> {
        return this.prisma.promotion.create({ data });
    }

    async findAll(params?: {
        skip?: number;
        take?: number;
        where?: Prisma.PromotionWhereInput;
        orderBy?: Prisma.PromotionOrderByWithRelationInput;
    }): Promise<Promotion[]> {
        const { skip, take, where, orderBy } = params || {};
        return this.prisma.promotion.findMany({
            skip,
            take,
            where,
            orderBy,
            include: {
                books: true,
                plans: true,
            },
        });
    }

    async findById(id: number): Promise<Promotion | null> {
        return this.prisma.promotion.findUnique({
            where: { id },
            include: {
                books: true,
                plans: true,
            },
        });
    }

    async update(
        id: number,
        data: Prisma.PromotionUpdateInput,
    ): Promise<Promotion> {
        return this.prisma.promotion.update({ where: { id }, data });
    }

    async delete(id: number): Promise<Promotion> {
        return this.prisma.promotion.delete({ where: { id } });
    }

    async findActivePromotionsForBook(bookId: number): Promise<Promotion[]> {
        const now = new Date();
        return this.prisma.promotion.findMany({
            where: {
                isActive: true,
                scope: PromotionScope.BOOK,
                startDate: { lte: now },
                endDate: { gte: now },
                OR: [{ applyToAllBooks: true }, { books: { some: { bookId } } }],
            },
            orderBy: { priority: 'desc' },
        });
    }

    async findActivePromotionsForPlan(planId: number): Promise<Promotion[]> {
        const now = new Date();
        return this.prisma.promotion.findMany({
            where: {
                isActive: true,
                scope: PromotionScope.SUBSCRIPTION,
                startDate: { lte: now },
                endDate: { gte: now },
                OR: [{ applyToAllPlans: true }, { plans: { some: { planId } } }],
            },
            orderBy: { priority: 'desc' },
        });
    }

    /**
     * Get all active book promotions in a single query (for batch processing)
     */
    async findAllActiveBookPromotions(): Promise<(Promotion & { books: { bookId: number }[] })[]> {
        const now = new Date();
        return this.prisma.promotion.findMany({
            where: {
                isActive: true,
                scope: PromotionScope.BOOK,
                startDate: { lte: now },
                endDate: { gte: now },
            },
            orderBy: { priority: 'desc' },
            include: {
                books: {
                    select: { bookId: true },
                },
            },
        });
    }

    /**
     * Get all active plan promotions in a single query (for batch processing)
     */
    async findAllActivePlanPromotions(): Promise<(Promotion & { plans: { planId: number }[] })[]> {
        const now = new Date();
        return this.prisma.promotion.findMany({
            where: {
                isActive: true,
                scope: PromotionScope.SUBSCRIPTION,
                startDate: { lte: now },
                endDate: { gte: now },
            },
            orderBy: { priority: 'desc' },
            include: {
                plans: {
                    select: { planId: true },
                },
            },
        });
    }
}
