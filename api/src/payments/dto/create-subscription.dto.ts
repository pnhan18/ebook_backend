import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';

export class CreateSubscriptionDto {
  @ApiProperty({ enum: SubscriptionPlan, example: 'PREMIUM' })
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;
}
