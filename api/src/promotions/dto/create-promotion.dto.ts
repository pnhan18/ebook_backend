import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateIf,
} from 'class-validator';
import { PromotionType, PromotionScope, PromotionDuration } from '@prisma/client';


export class CreatePromotionDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsEnum(PromotionScope)
    scope: PromotionScope;

    @IsEnum(PromotionType)
    type: PromotionType;

    @IsNumber()
    @Min(0)
    value: number;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsInt()
    @Min(0)
    priority: number;

    // Subscription specific - only applicable when scope is SUBSCRIPTION
    @ValidateIf((o) => o.scope === 'SUBSCRIPTION')
    @IsOptional()
    @IsEnum(PromotionDuration)
    duration?: PromotionDuration;

    @ValidateIf((o) => o.scope === 'SUBSCRIPTION' && o.duration === 'REPEATING')
    @IsInt()
    @Min(1)
    durationInMonths?: number;

    // Configuration
    @IsOptional()
    @IsBoolean()
    applyToAllBooks?: boolean;

    @IsOptional()
    @IsBoolean()
    applyToAllPlans?: boolean;

    @IsOptional()
    @IsInt({ each: true })
    bookIds?: number[];

    @IsOptional()
    @IsInt({ each: true })
    planIds?: number[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    minOrderValue?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    maxDiscountValue?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    usageLimit?: number;
}
