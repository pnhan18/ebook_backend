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

@Injectable()
export class PlansService {
  constructor(
    @Inject('IPlansRepository')
    private readonly plansRepository: IPlansRepository,
  ) { }

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
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findActive(): Promise<Plan[]> {
    return this.plansRepository.findActive();
  }

  async findOne(id: number): Promise<Plan> {
    const plan = await this.plansRepository.findById(id);
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return plan;
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
