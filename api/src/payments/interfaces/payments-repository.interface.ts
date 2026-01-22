import { Payment, BookPurchase, Subscription, Prisma, Book } from '@prisma/client';

// ==================== PAYMENT ====================
export interface IPaymentRepository {
  create(data: Prisma.PaymentCreateInput): Promise<Payment>;
  findById(id: number): Promise<Payment | null>;
  findByStripePaymentIntentId(id: string): Promise<Payment | null>;
  findByUserId(userId: number): Promise<Payment[]>;
  update(id: number, data: Prisma.PaymentUpdateInput): Promise<Payment>;
  updateByStripePaymentIntentId(
    id: string,
    data: Prisma.PaymentUpdateInput,
  ): Promise<Payment>;
}

// ==================== BOOK PURCHASE ====================
export interface IBookPurchaseRepository {
  create(data: Prisma.BookPurchaseCreateInput): Promise<BookPurchase>;
  findByUserAndBook(
    userId: number,
    bookId: number,
  ): Promise<BookPurchase | null>;
  findByUserId(userId: number): Promise<(BookPurchase & { book: Book })[]>;
}

// ==================== SUBSCRIPTION ====================
export interface ISubscriptionRepository {
  create(data: Prisma.SubscriptionCreateInput): Promise<Subscription>;
  findByUserId(userId: number): Promise<Subscription | null>;
  findByStripeCustomerId(customerId: string): Promise<Subscription | null>;
  update(
    userId: number,
    data: Prisma.SubscriptionUpdateInput,
  ): Promise<Subscription>;
  upsert(
    userId: number,
    create: Prisma.SubscriptionCreateInput,
    update: Prisma.SubscriptionUpdateInput,
  ): Promise<Subscription>;
}
