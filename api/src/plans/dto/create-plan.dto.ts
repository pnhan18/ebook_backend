import { IsEnum, IsString, IsNumber, IsOptional, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlan, BillingInterval } from '@prisma/client';

export class CreatePlanDto {
  @ApiProperty({ enum: SubscriptionPlan, example: 'PREMIUM' })
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @ApiProperty({ example: 'Gói Premium' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Truy cập không giới hạn tất cả sách' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 99000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'vnd', default: 'vnd' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: BillingInterval, default: 'MONTH' })
  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;

  @ApiPropertyOptional({ example: 1, description: 'Số chu kỳ (ví dụ: 3 cho gói 3 tháng)', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  intervalCount?: number;

  @ApiPropertyOptional({ example: ['Đọc không giới hạn', 'Không quảng cáo'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
