import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentStatus,
  SubscriptionStatus,
  SubscriptionPlan,
} from '@prisma/client';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { BooksService } from '../books/books.service';
import { StripeService } from './stripe.service';
import { PlansService } from '../plans/plans.service';
import type {
  IPaymentRepository,
  IBookPurchaseRepository,
  ISubscriptionRepository,
} from './interfaces';

@Injectable()
export class PaymentsService {
  constructor(
    private usersService: UsersService,
    private booksService: BooksService,
    private stripeService: StripeService,
    private configService: ConfigService,
    private plansService: PlansService,
    @Inject('IPaymentRepository')
    private paymentRepository: IPaymentRepository,
    @Inject('IBookPurchaseRepository')
    private bookPurchaseRepository: IBookPurchaseRepository,
    @Inject('ISubscriptionRepository')
    private subscriptionRepository: ISubscriptionRepository,
  ) { }

  // ==================== CUSTOMER ====================

  async getOrCreateStripeCustomer(userId: number): Promise<string> {
    const user = await this.usersService.findByIdRaw(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripeService.createCustomer(
      user.email,
      user.username,
    );

    await this.usersService.updateStripeCustomerId(userId, customer.id);

    return customer.id;
  }

  // ==================== BOOK PURCHASE ====================

  async createBookPaymentIntent(userId: number, bookId: number) {
    const book = await this.booksService.findOne(bookId);

    if (book.accessType === 'FREE') {
      throw new BadRequestException('This book is free');
    }

    if (!book.price) {
      throw new BadRequestException('Book price not set');
    }

    const existingPurchase =
      await this.bookPurchaseRepository.findByUserAndBook(userId, bookId);
    if (existingPurchase) {
      throw new BadRequestException('Book already purchased');
    }

    const customerId = await this.getOrCreateStripeCustomer(userId);
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    const session = await this.stripeService.createCheckoutSession({
      customerId,
      bookData: {
        name: book.title,
        description: book.description || undefined,
        price: Number(book.price),
        currency: 'vnd',
        imageUrl: book.coverImage || undefined,
        bookId: bookId.toString(),
      },
      successUrl: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/payment/cancel`,
      metadata: {
        userId: userId.toString(),
        bookId: bookId.toString(),
        type: 'book_purchase',
      },
    });

    return { checkoutUrl: session.url };
  }

  async hasUserPurchasedBook(userId: number, bookId: number): Promise<boolean> {
    const purchase = await this.bookPurchaseRepository.findByUserAndBook(
      userId,
      bookId,
    );
    return !!purchase;
  }

  async getUserPurchasedBooks(userId: number) {
    return this.bookPurchaseRepository.findByUserId(userId);
  }

  // ==================== SUBSCRIPTION ====================

  async createSubscriptionCheckout(userId: number, planType: SubscriptionPlan) {
    if (planType === SubscriptionPlan.FREE) {
      throw new BadRequestException('Cannot subscribe to free plan');
    }

    // Kiểm tra xem user đã có subscription đang hoạt động chưa
    const existingSubscription =
      await this.subscriptionRepository.findByUserId(userId);
    if (
      existingSubscription &&
      existingSubscription.status === SubscriptionStatus.ACTIVE &&
      existingSubscription.currentPeriodEnd > new Date()
    ) {
      throw new BadRequestException(
        'You already have an active subscription. Please cancel your current subscription before subscribing to a new plan.',
      );
    }

    const plan = await this.plansService.findByPlan(planType);
    if (!plan || !plan.stripePriceId) {
      throw new BadRequestException('Subscription plan not configured');
    }

    const customerId = await this.getOrCreateStripeCustomer(userId);
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    const session = await this.stripeService.createCheckoutSession({
      customerId,
      priceId: plan.stripePriceId,
      successUrl: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/payment/cancel`,
      metadata: { userId: userId.toString(), plan: planType },
    });

    return { checkoutUrl: session.url };
  }

  async getUserSubscription(userId: number) {
    return this.subscriptionRepository.findByUserId(userId);
  }

  async cancelSubscription(userId: number) {
    const subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new NotFoundException('No active subscription found');
    }

    await this.stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
    );

    // Không đổi status thành CANCELLED ngay, chỉ đánh dấu sẽ hủy cuối kỳ
    return this.subscriptionRepository.update(userId, {
      cancelAtPeriodEnd: true,
      cancelledAt: new Date(),
    });
  }

  async hasActiveSubscription(userId: number): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription) return false;

    return (
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.currentPeriodEnd > new Date()
    );
  }

  // ==================== WEBHOOK HANDLERS ====================

  async handleWebhook(payload: Buffer, signature: string) {
    const event = this.stripeService.constructWebhookEvent(payload, signature);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
    }

    return { received: true };
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(
      paymentIntent.id,
    );

    if (!payment) return;

    await this.paymentRepository.update(payment.id, {
      status: PaymentStatus.COMPLETED,
      stripeChargeId: paymentIntent.latest_charge as string,
    });
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const metadata = session.metadata;
    if (!metadata) return;

    // Xử lý mua sách (one-time payment)
    if (
      metadata.type === 'book_purchase' &&
      metadata.userId &&
      metadata.bookId
    ) {
      // Kiểm tra payment_intent tồn tại (chỉ có với mode payment, không có với subscription)
      if (!session.payment_intent) return;

      // Kiểm tra đã xử lý chưa để tránh duplicate
      const existingPayment =
        await this.paymentRepository.findByStripePaymentIntentId(
          session.payment_intent as string,
        );
      if (existingPayment) return;

      const userId = parseInt(metadata.userId);
      const bookId = parseInt(metadata.bookId);

      const book = await this.booksService.findOne(bookId).catch(() => null);
      if (!book || !book.price) return;

      // Tạo payment record
      const payment = await this.paymentRepository.create({
        user: { connect: { id: userId } },
        amount: book.price,
        currency: 'vnd',
        status: PaymentStatus.COMPLETED,
        stripePaymentIntentId: session.payment_intent as string,
        metadata: { bookId },
      });

      // Tạo book purchase record
      await this.bookPurchaseRepository.create({
        user: { connect: { id: userId } },
        book: { connect: { id: bookId } },
        payment: { connect: { id: payment.id } },
        price: book.price,
      });
    }

    // Xử lý subscription
    if (
      session.mode === 'subscription' &&
      metadata.userId &&
      session.customer
    ) {
      const userId = parseInt(metadata.userId);
      await this.usersService.updateStripeCustomerId(
        userId,
        session.customer as string,
      );
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(
      paymentIntent.id,
    );
    if (payment) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
      });
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    // Tìm user bằng stripeCustomerId
    let user = await this.usersService.findByStripeCustomerId(customerId);

    // Fallback: tìm từ metadata nếu có
    if (!user && subscription.metadata?.userId) {
      const userId = parseInt(subscription.metadata.userId);
      user = await this.usersService.findByIdRaw(userId);

      // Cập nhật stripeCustomerId cho user
      if (user) {
        await this.usersService.updateStripeCustomerId(userId, customerId);
      }
    }

    if (!user) {
      console.error(`[Webhook] User not found for customer: ${customerId}`);
      return;
    }

    const status = this.mapStripeSubscriptionStatus(subscription.status);

    const subscriptionItem = subscription.items.data[0];
    const currentPeriodStart = new Date(
      subscriptionItem.current_period_start * 1000,
    );
    const currentPeriodEnd = new Date(
      subscriptionItem.current_period_end * 1000,
    );

    const stripePriceId = subscriptionItem?.price.id;

    await this.subscriptionRepository.upsert(
      user.id,
      {
        user: { connect: { id: user.id } },
        plan: SubscriptionPlan.PREMIUM,
        status,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        stripePriceId: stripePriceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      {
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    );

    const activeStatuses: SubscriptionStatus[] = [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.PAST_DUE,
      SubscriptionStatus.TRIALING,
    ];
    const newPlan = activeStatuses.includes(status)
      ? SubscriptionPlan.PREMIUM
      : SubscriptionPlan.FREE;
    await this.usersService.updateSubscriptionPlan(user.id, newPlan);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const user = await this.usersService.findByStripeCustomerId(
      subscription.customer as string,
    );

    if (!user) return;

    await this.subscriptionRepository.update(user.id, {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    await this.usersService.updateSubscriptionPlan(user.id, 'FREE');
  }

  private mapStripeSubscriptionStatus(
    status: Stripe.Subscription.Status,
  ): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELLED,
      incomplete: SubscriptionStatus.INCOMPLETE,
      trialing: SubscriptionStatus.TRIALING,
    };
    return statusMap[status] || SubscriptionStatus.INCOMPLETE;
  }

  // ==================== PAYMENT HISTORY ====================

  async getUserPayments(userId: number) {
    return this.paymentRepository.findByUserId(userId);
  }
}
