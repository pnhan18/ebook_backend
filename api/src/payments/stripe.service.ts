import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingInterval, Plan } from '@prisma/client';
import Stripe from 'stripe';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class StripeService implements OnModuleInit {
  public stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => PlansService))
    private plansService: PlansService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    });
  }

  async onModuleInit() {
    try {
      await this.syncAllPlans();
    } catch (error) {
      this.logger.error('❌ Lỗi khi đồng bộ Stripe:', error);
    }
  }

  // Currencies without decimals (like VND, JPY) - removed duplicate 'vnd'
  private readonly zeroDecimalCurrencies = [
    'vnd',
    'jpy',
    'krw',
    'bif',
    'clp',
    'djf',
    'gnf',
    'kmf',
    'mga',
    'pyg',
    'rwf',
    'ugx',
    'vuv',
    'xaf',
    'xof',
    'xpf',
  ];

  private toStripeAmount(amount: number, currency: string): number {
    if (this.zeroDecimalCurrencies.includes(currency.toLowerCase())) {
      return Math.round(amount); // VND: 120000 → 120000
    }
    return Math.round(amount * 100); // USD: 9.99 → 999
  }

  // ==================== PRODUCT SYNC ====================

  async syncAllPlans(): Promise<void> {
    const plans = await this.plansService.findActive();

    for (const plan of plans) {
      await this.syncPlanToStripe(plan);
    }
  }

  async syncPlanToStripe(plan: Plan): Promise<Plan> {
    const interval = plan.interval === BillingInterval.YEAR ? 'year' : 'month';
    const amountInSmallestUnit = this.toStripeAmount(
      Number(plan.price),
      plan.currency,
    );

    let product: Stripe.Product;

    // Get or create product
    if (plan.stripeProductId) {
      product = await this.stripe.products.retrieve(plan.stripeProductId);
      // Update if changed
      if (
        product.name !== plan.name ||
        product.description !== plan.description
      ) {
        product = await this.stripe.products.update(plan.stripeProductId, {
          name: plan.name,
          description: plan.description || undefined,
        });
      }
    } else {
      product = await this.stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: { plan: plan.plan },
      });
      this.logger.log(`Created Stripe product: ${product.id}`);
    }

    // Check if current price matches
    let needNewPrice = !plan.stripePriceId;

    if (plan.stripePriceId) {
      const currentPrice = await this.stripe.prices.retrieve(
        plan.stripePriceId,
      );
      if (
        currentPrice.unit_amount !== amountInSmallestUnit ||
        currentPrice.currency !== plan.currency ||
        currentPrice.recurring?.interval !== interval
      ) {
        // Deactivate old price
        await this.stripe.prices.update(plan.stripePriceId, { active: false });
        needNewPrice = true;
      }
    }

    let priceId = plan.stripePriceId;

    if (needNewPrice) {
      const newPrice = await this.stripe.prices.create({
        product: product.id,
        unit_amount: amountInSmallestUnit,
        currency: plan.currency,
        recurring: { interval },
      });
      priceId = newPrice.id;
      this.logger.log(`Created Stripe price: ${newPrice.id}`);
    }

    // Update database via PlansService
    return this.plansService.updateStripeIds(plan.id, product.id, priceId!);
  }

  // ==================== CUSTOMER ====================

  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      name,
    });
  }

  // ==================== CHECKOUT SESSION ====================

  async createCheckoutSession(params: {
    customerId: string;
    successUrl: string;
    cancelUrl: string;
    priceId?: string; // Dùng cho Subscription (Gói)
    bookData?: {
      // Dùng cho One-time Payment (Sách)
      name: string;
      description?: string;
      price: number;
      currency: string;
      imageUrl?: string;
      bookId: string;
    };
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let mode: Stripe.Checkout.Session.Mode = 'payment'; // Mặc định mua đứt

    // CASE 1: Mua Gói (Subscription)
    if (params.priceId) {
      mode = 'subscription';
      lineItems.push({
        price: params.priceId,
        quantity: 1,
      });
    }
    // CASE 2: Mua Sách (One-time)
    else if (params.bookData) {
      mode = 'payment';
      lineItems.push({
        price_data: {
          currency: params.bookData.currency,
          product_data: {
            name: params.bookData.name,
            description: params.bookData.description,
            images: params.bookData.imageUrl ? [params.bookData.imageUrl] : [],
            metadata: { bookId: params.bookData.bookId },
          },
          unit_amount: this.toStripeAmount(
            params.bookData.price,
            params.bookData.currency,
          ),
        },
        quantity: 1,
      });
    } else {
      throw new Error('Missing priceId or bookData');
    }

    return this.stripe.checkout.sessions.create({
      customer: params.customerId,
      mode: mode,
      line_items: lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      // Metadata cho mua sách
      payment_intent_data:
        mode === 'payment'
          ? { metadata: { ...params.metadata, type: 'ONE_TIME' } }
          : undefined,
      // Metadata cho mua gói
      subscription_data:
        mode === 'subscription'
          ? { metadata: { ...params.metadata, type: 'SUBSCRIPTION' } }
          : undefined,
    });
  }

  // ==================== SUBSCRIPTION ====================

  async cancelSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  // ==================== WEBHOOK ====================

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }
}
