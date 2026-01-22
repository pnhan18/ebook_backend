import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PlansModule } from '../plans/plans.module';
import { UsersModule } from '../users/users.module';
import { BooksModule } from '../books/books.module';
import { StorageModule } from '../storage/storage.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripeService } from './stripe.service';
import {
  PaymentRepository,
  BookPurchaseRepository,
  SubscriptionRepository,
} from './repositories';

@Module({
  imports: [ConfigModule, PrismaModule, PlansModule, UsersModule, BooksModule, StorageModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    StripeService,
    {
      provide: 'IPaymentRepository',
      useClass: PaymentRepository,
    },
    {
      provide: 'IBookPurchaseRepository',
      useClass: BookPurchaseRepository,
    },
    {
      provide: 'ISubscriptionRepository',
      useClass: SubscriptionRepository,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule { }
