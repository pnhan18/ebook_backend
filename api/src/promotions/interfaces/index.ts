import { Promotion, Prisma } from '@prisma/client';

export interface IPromotionRepository {
    create(data: Prisma.PromotionCreateInput): Promise<Promotion>;
    findAll(params?: {
        skip?: number;
        take?: number;
        where?: Prisma.PromotionWhereInput;
        orderBy?: Prisma.PromotionOrderByWithRelationInput;
    }): Promise<Promotion[]>;
    findById(id: number): Promise<Promotion | null>;
    update(id: number, data: Prisma.PromotionUpdateInput): Promise<Promotion>;
    delete(id: number): Promise<Promotion>;

    findActivePromotionsForBook(bookId: number): Promise<Promotion[]>;
    findActivePromotionsForPlan(planId: number): Promise<Promotion[]>;
    findAllActiveBookPromotions(): Promise<(Promotion & { books: { bookId: number }[] })[]>;
    findAllActivePlanPromotions(): Promise<(Promotion & { plans: { planId: number }[] })[]>;
}
