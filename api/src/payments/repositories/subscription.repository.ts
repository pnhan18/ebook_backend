import { Injectable } from '@nestjs/common';
import { Subscription, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ISubscriptionRepository } from '../interfaces';

@Injectable()
export class SubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.SubscriptionCreateInput): Promise<Subscription> {
    return this.prisma.subscription.create({ data });
  }

  async findByUserId(userId: number): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  async findByStripeCustomerId(
    customerId: string,
  ): Promise<Subscription | null> {
    return this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
  }

  async update(
    userId: number,
    data: Prisma.SubscriptionUpdateInput,
  ): Promise<Subscription> {
    return this.prisma.subscription.update({ where: { userId }, data });
  }

  async upsert(
    userId: number,
    create: Prisma.SubscriptionCreateInput,
    update: Prisma.SubscriptionUpdateInput,
  ): Promise<Subscription> {
    return this.prisma.subscription.upsert({
      where: { userId },
      create,
      update,
    });
  }
}
