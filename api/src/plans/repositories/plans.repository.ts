import { Injectable } from '@nestjs/common';
import { Plan, Prisma, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FindAllOptions, FindAllResult, IPlansRepository } from '../interfaces/plans-repository.interface';

@Injectable()
export class PlansRepository implements IPlansRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: Prisma.PlanCreateInput): Promise<Plan> {
    return this.prisma.plan.create({ data });
  }

  async findAll(options: FindAllOptions): Promise<FindAllResult> {
    const { page, limit, isActive } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.PlanWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.plan.findMany({
        where,
        orderBy: { price: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          plan: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          features: true,
          interval: true,
          intervalCount: true,
          isActive: true,
        },
      }),
      this.prisma.plan.count({ where }),
    ]);

    return { data, total };
  }

  async findActive(): Promise<Plan[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ intervalCount: 'asc' }, { price: 'asc' }],
      select: {
        id: true,
        name: true,
        interval: true,
        intervalCount: true,
        price: true,
        features: true,
      },
    });
    return plans as unknown as Plan[];
  }

  async findById(id: number): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async findByPlan(plan: SubscriptionPlan): Promise<Plan | null> {
    return this.prisma.plan.findFirst({
      where: { plan, isActive: true },
    });
  }

  async findByPlanConfig(
    plan: SubscriptionPlan,
    interval: string,
    intervalCount: number,
  ): Promise<Plan | null> {
    return this.prisma.plan.findFirst({
      where: { plan, interval: interval as any, intervalCount },
    });
  }

  async update(id: number, data: Prisma.PlanUpdateInput): Promise<Plan> {
    return this.prisma.plan.update({ where: { id }, data });
  }

  async delete(id: number): Promise<Plan> {
    return this.prisma.plan.delete({ where: { id } });
  }
}
