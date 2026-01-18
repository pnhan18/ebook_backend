import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../common/decorators';
import { CreateSubscriptionDto } from './dto';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
  ) { }

  // ==================== BOOK PURCHASE ====================

  @Post('book/:bookId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create payment intent for book purchase' })
  createBookPayment(
    @CurrentUser('id') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.paymentsService.createBookPaymentIntent(userId, bookId);
  }

  @Get('book/:bookId/check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Check if user has purchased a book' })
  async checkBookPurchase(
    @CurrentUser('id') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    const purchased = await this.paymentsService.hasUserPurchasedBook(
      userId,
      bookId,
    );
    return { purchased };
  }

  @Get('purchases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user purchased books' })
  getUserPurchases(@CurrentUser('id') userId: number) {
    return this.paymentsService.getUserPurchasedBooks(userId);
  }

  // ==================== SUBSCRIPTION ====================

  @Post('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create subscription checkout session' })
  createSubscription(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.paymentsService.createSubscriptionCheckout(userId, dto.plan);
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user subscription' })
  getUserSubscription(@CurrentUser('id') userId: number) {
    return this.paymentsService.getUserSubscription(userId);
  }

  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription' })
  cancelSubscription(@CurrentUser('id') userId: number) {
    return this.paymentsService.cancelSubscription(userId);
  }

  // ==================== PAYMENT HISTORY ====================

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user payment history' })
  getPaymentHistory(@CurrentUser('id') userId: number) {
    return this.paymentsService.getUserPayments(userId);
  }

  // ==================== WEBHOOK ====================

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook handler' })
  async handleWebhook(
    @Req() req: RawBodyRequest,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!req.rawBody) {
      throw new BadRequestException(
        'Raw body is required for webhook verification',
      );
    }
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }

  // ==================== ADMIN ====================

  @Post('admin/sync-stripe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync all plans to Stripe (Admin only)' })
  async syncStripe() {
    await this.stripeService.syncAllPlans();
    return { message: 'Stripe plans synced successfully' };
  }
}
