import { Plan, Prisma, SubscriptionPlan } from '@prisma/client';

export interface FindAllOptions {
  page: number;
  limit: number;
  isActive?: boolean;
}

export type PlanSummary = Pick<Plan, 'id' | 'plan' | 'name' | 'description' | 'price' | 'currency'>;

export interface FindAllResult {
  data: PlanSummary[];
  total: number;
}

export interface IPlansRepository {
  create(data: Prisma.PlanCreateInput): Promise<Plan>;
  findAll(options: FindAllOptions): Promise<FindAllResult>;
  findActive(): Promise<Plan[]>;
  findById(id: number): Promise<Plan | null>;
  findByPlan(plan: SubscriptionPlan): Promise<Plan | null>;
  findByPlanConfig(plan: SubscriptionPlan, interval: string, intervalCount: number): Promise<Plan | null>;
  update(id: number, data: Prisma.PlanUpdateInput): Promise<Plan>;
  delete(id: number): Promise<Plan>;
}
