import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController, AdminPlansController } from './plans.controller';
import { PlansRepository } from './repositories/plans.repository';
import { PrismaModule } from '../prisma/prisma.module';

import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [PrismaModule, PromotionsModule],
  providers: [
    PlansService,
    {
      provide: 'IPlansRepository',
      useClass: PlansRepository,
    },
  ],
  controllers: [PlansController, AdminPlansController],
  exports: [PlansService],
})
export class PlansModule { }
