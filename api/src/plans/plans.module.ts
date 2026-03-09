import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController, AdminPlansController } from './plans.controller';
import { PlansRepository } from './repositories/plans.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
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
export class PlansModule {}
