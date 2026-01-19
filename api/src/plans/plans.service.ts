import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { Plan, SubscriptionPlan } from '@prisma/client';
import { CreatePlanDto, UpdatePlanDto, QueryPlanDto } from './dto';
import { PaginatedResponseDto } from '../common';
import type { IPlansRepository } from './interfaces/plans-repository.interface';
import { PlanSummary } from './interfaces/plans-repository.interface';
import { PromotionsService } from '../promotions/promotions.service';

@Injectable()
export class PlansService {
  constructor(
    @Inject('IPlansRepository')
    private readonly plansRepository: IPlansRepository,
    private readonly promotionsService: PromotionsService,
  ) { }

  private async applyPromotionToPlan(plan: any) {
    if (!plan) return plan;
    const priceInfo = await this.promotionsService.calculatePlanPrice(plan);

    let isOnPromotion = false;
    let promotion: {
      startDate: Date;
      endDate: Date;
      type: string;
      value: number;
      duration: string;
      durationInMonths: number | null;
    } | null = null;

    if (priceInfo.promotion && priceInfo.discountAmount > 0) {
      isOnPromotion = true;
      promotion = {
        startDate: priceInfo.promotion.startDate,
        endDate: priceInfo.promotion.endDate,
        type: priceInfo.promotion.type,
        value: Number(priceInfo.promotion.value),
        duration: priceInfo.promotion.duration,
        durationInMonths: priceInfo.promotion.durationInMonths,
      };
    }

    return {
      ...plan,
      price: Number(plan.price),
      isOnPromotion,
      promotion,
    };
  }

  /**
   * Batch apply promotions to multiple plans (performance optimized - 1 DB query)
   */
  private async applyPromotionsToPlans(plans: any[]) {
    if (plans.length === 0) return [];

    // Get all promotion data in ONE query
    const priceInfos = await this.promotionsService.calculatePlanPricesBatch(plans);

    // Create a map for quick lookup
    const priceInfoMap = new Map(priceInfos.map(p => [p.planId, p]));

    // Apply promotion data to plans
    return plans.map(plan => {
      const priceInfo = priceInfoMap.get(plan.id);

      if (!priceInfo || !priceInfo.promotion || priceInfo.discountAmount <= 0) {
        return {
          ...plan,
          price: Number(plan.price),
          isOnPromotion: false,
          promotion: null,
        };
      }

      return {
        ...plan,
        price: Number(plan.price),
        isOnPromotion: true,
        promotion: {
          startDate: priceInfo.promotion.startDate,
          endDate: priceInfo.promotion.endDate,
          type: priceInfo.promotion.type,
          value: Number(priceInfo.promotion.value),
          duration: priceInfo.promotion.duration,
          durationInMonths: priceInfo.promotion.durationInMonths,
        },
      };
    });
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    const interval = dto.interval || 'MONTH';
    const intervalCount = dto.intervalCount ?? 1;

    // Check if plan with same config already exists
    const existing = await this.plansRepository.findByPlanConfig(
      dto.plan,
      interval,
      intervalCount,
    );
    if (existing) {
      throw new ConflictException(
        `Plan ${dto.plan} with interval ${interval} x ${intervalCount} already exists`,
      );
    }

    return this.plansRepository.create({
      plan: dto.plan,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      currency: dto.currency || 'vnd',
      interval: interval,
      intervalCount: intervalCount,
      features: dto.features,
      isActive: dto.isActive ?? true,
    });
  }

  async findAll(
    query: QueryPlanDto,
  ): Promise<PaginatedResponseDto<PlanSummary>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.plansRepository.findAll({
      page,
      limit,
      isActive: query.isActive,
    });
    const dataWithPromotions = await this.applyPromotionsToPlans(data);
    return new PaginatedResponseDto(dataWithPromotions, total, page, limit);
  }

  async findActive(): Promise<Plan[]> {
    const plans = await this.plansRepository.findActive();
    return this.applyPromotionsToPlans(plans);
  }

  async findOne(id: number): Promise<Plan> {
    const plan = await this.plansRepository.findById(id);
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return this.applyPromotionToPlan(plan);
  }

  async findByPlan(plan: SubscriptionPlan): Promise<Plan | null> {
    return this.plansRepository.findByPlan(plan);
  }

  async update(id: number, dto: UpdatePlanDto): Promise<Plan> {
    await this.findOne(id);
    return this.plansRepository.update(id, dto);
  }

  async remove(id: number): Promise<Plan> {
    await this.findOne(id);
    return this.plansRepository.delete(id);
  }

  /**
   * Update Stripe product and price IDs for a plan
   * Used by StripeService during sync
   */
  async updateStripeIds(
    id: number,
    stripeProductId: string,
    stripePriceId: string,
  ): Promise<Plan> {
    return this.plansRepository.update(id, {
      stripeProductId,
      stripePriceId,
    });
  }
}
