import {
    Injectable,
    Inject,
    NotFoundException,
} from '@nestjs/common';
import type { IPromotionRepository } from './interfaces';
import {
    CreatePromotionDto,
} from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionType, Book, Plan } from '@prisma/client';

@Injectable()
export class PromotionsService {
    constructor(
        @Inject('IPromotionRepository')
        private readonly promotionRepository: IPromotionRepository,
    ) { }

    async create(createPromotionDto: CreatePromotionDto) {
        const { bookIds, planIds, ...rest } = createPromotionDto;

        const data: any = {
            ...rest,
            books: bookIds
                ? {
                    create: bookIds.map((id) => ({ book: { connect: { id } } })),
                }
                : undefined,
            plans: planIds
                ? {
                    create: planIds.map((id) => ({ plan: { connect: { id } } })),
                }
                : undefined,
        };

        return this.promotionRepository.create(data);
    }

    async findAll() {
        return this.promotionRepository.findAll({
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: number) {
        const promotion = await this.promotionRepository.findById(id);
        if (!promotion) {
            throw new NotFoundException(`Promotion with ID ${id} not found`);
        }
        return promotion;
    }

    async update(id: number, updatePromotionDto: UpdatePromotionDto) {
        const { bookIds, planIds, ...rest } = updatePromotionDto;

        const data: any = { ...rest };

        return this.promotionRepository.update(id, data);
    }

    async remove(id: number) {
        return this.promotionRepository.delete(id);
    }

    async calculateBookPrice(book: Book) {
        const promotions = await this.promotionRepository.findActivePromotionsForBook(
            book.id,
        );

        // Get the highest priority promotion
        const bestPromotion = promotions[0]; // Already ordered by priority desc

        if (!bestPromotion || !book.price) {
            return {
                originalPrice: Number(book.price),
                finalPrice: Number(book.price),
                discountAmount: 0,
                promotion: null,
            };
        }

        let discountAmount = 0;
        const originalPrice = Number(book.price);

        if (bestPromotion.type === PromotionType.PERCENTAGE) {
            discountAmount = originalPrice * (Number(bestPromotion.value) / 100);
            if (bestPromotion.maxDiscountValue) {
                discountAmount = Math.min(
                    discountAmount,
                    Number(bestPromotion.maxDiscountValue),
                );
            }
        } else {
            discountAmount = Number(bestPromotion.value);
        }

        // Ensure final price is not negative
        let finalPrice = originalPrice - discountAmount;
        if (finalPrice < 0) finalPrice = 0;

        return {
            originalPrice,
            finalPrice,
            discountAmount,
            promotion: bestPromotion,
        };
    }

    async calculatePlanPrice(plan: Plan) {
        const promotions = await this.promotionRepository.findActivePromotionsForPlan(
            plan.id,
        );
        const bestPromotion = promotions[0];

        if (!bestPromotion) {
            return {
                originalPrice: Number(plan.price),
                finalPrice: Number(plan.price),
                discountAmount: 0,
                promotion: null,
            };
        }

        let discountAmount = 0;
        const originalPrice = Number(plan.price);

        if (bestPromotion.type === PromotionType.PERCENTAGE) {
            discountAmount = originalPrice * (Number(bestPromotion.value) / 100);
            if (bestPromotion.maxDiscountValue) {
                discountAmount = Math.min(
                    discountAmount,
                    Number(bestPromotion.maxDiscountValue),
                );
            }
        } else {
            discountAmount = Number(bestPromotion.value);
        }

        let finalPrice = originalPrice - discountAmount;
        if (finalPrice < 0) finalPrice = 0;

        return {
            originalPrice,
            finalPrice,
            discountAmount,
            promotion: bestPromotion,
        };
    }

    /**
     * Batch calculate prices for multiple books (performance optimized)
     * Only 1 database query instead of N queries
     */
    async calculateBookPricesBatch(books: Book[]) {
        if (books.length === 0) return [];

        // Get all active book promotions in ONE query
        const allPromotions = await this.promotionRepository.findAllActiveBookPromotions();

        // Build a map: bookId -> best promotion
        const bookPromotionMap = new Map<number, typeof allPromotions[0] | null>();

        for (const book of books) {
            // Find best promotion for this book (highest priority)
            const applicablePromotions = allPromotions.filter(promo =>
                promo.applyToAllBooks || promo.books.some(b => b.bookId === book.id)
            );
            // Already sorted by priority desc from DB
            bookPromotionMap.set(book.id, applicablePromotions[0] || null);
        }

        // Calculate prices for each book
        return books.map(book => {
            const bestPromotion = bookPromotionMap.get(book.id);
            const originalPrice = Number(book.price) || 0;

            if (!bestPromotion || originalPrice <= 0) {
                return {
                    bookId: book.id,
                    originalPrice,
                    finalPrice: originalPrice,
                    discountAmount: 0,
                    promotion: null,
                };
            }

            let discountAmount = 0;
            if (bestPromotion.type === PromotionType.PERCENTAGE) {
                discountAmount = originalPrice * (Number(bestPromotion.value) / 100);
                if (bestPromotion.maxDiscountValue) {
                    discountAmount = Math.min(
                        discountAmount,
                        Number(bestPromotion.maxDiscountValue),
                    );
                }
            } else {
                discountAmount = Number(bestPromotion.value);
            }

            let finalPrice = originalPrice - discountAmount;
            if (finalPrice < 0) finalPrice = 0;

            return {
                bookId: book.id,
                originalPrice,
                finalPrice,
                discountAmount,
                promotion: bestPromotion,
            };
        });
    }

    /**
     * Batch calculate prices for multiple plans (performance optimized)
     * Only 1 database query instead of N queries
     */
    async calculatePlanPricesBatch(plans: Plan[]) {
        if (plans.length === 0) return [];

        // Get all active plan promotions in ONE query
        const allPromotions = await this.promotionRepository.findAllActivePlanPromotions();

        // Build a map: planId -> best promotion
        const planPromotionMap = new Map<number, typeof allPromotions[0] | null>();

        for (const plan of plans) {
            // Find best promotion for this plan (highest priority)
            const applicablePromotions = allPromotions.filter(promo =>
                promo.applyToAllPlans || promo.plans.some(p => p.planId === plan.id)
            );
            // Already sorted by priority desc from DB
            planPromotionMap.set(plan.id, applicablePromotions[0] || null);
        }

        // Calculate prices for each plan
        return plans.map(plan => {
            const bestPromotion = planPromotionMap.get(plan.id);
            const originalPrice = Number(plan.price) || 0;

            if (!bestPromotion || originalPrice <= 0) {
                return {
                    planId: plan.id,
                    originalPrice,
                    finalPrice: originalPrice,
                    discountAmount: 0,
                    promotion: null,
                };
            }

            let discountAmount = 0;
            if (bestPromotion.type === PromotionType.PERCENTAGE) {
                discountAmount = originalPrice * (Number(bestPromotion.value) / 100);
                if (bestPromotion.maxDiscountValue) {
                    discountAmount = Math.min(
                        discountAmount,
                        Number(bestPromotion.maxDiscountValue),
                    );
                }
            } else {
                discountAmount = Number(bestPromotion.value);
            }

            let finalPrice = originalPrice - discountAmount;
            if (finalPrice < 0) finalPrice = 0;

            return {
                planId: plan.id,
                originalPrice,
                finalPrice,
                discountAmount,
                promotion: bestPromotion,
            };
        });
    }
}
