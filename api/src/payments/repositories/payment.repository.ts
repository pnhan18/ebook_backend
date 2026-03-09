import { Injectable } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentRepository } from '../interfaces';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  async findById(id: number): Promise<Payment | null> {
    return this.prisma.payment.findUnique({ where: { id } });
  }

  async findByStripePaymentIntentId(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: id },
    });
  }

  async findByUserId(userId: number): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { userId },
      include: { bookPurchases: { include: { book: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: number, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return this.prisma.payment.update({ where: { id }, data });
  }

  async updateByStripePaymentIntentId(
    stripePaymentIntentId: string,
    data: Prisma.PaymentUpdateInput,
  ): Promise<Payment> {
    return this.prisma.payment.update({
      where: { stripePaymentIntentId },
      data,
    });
  }
}
