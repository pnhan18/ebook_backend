import {
    IsString,
    IsOptional,
    IsBoolean,
    IsNumber,
    IsArray,
    Min,
    IsEnum,
    ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookAccessType } from '@prisma/client';

export class UpdateBookDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsEnum(BookAccessType, {
        message: 'accessType must be one of: FREE, PURCHASE, MEMBERSHIP',
    })
    accessType?: BookAccessType;

    @IsOptional()
    @IsString()
    slug?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    coverImage?: string;

    @IsOptional()
    @IsString()
    sourceKey?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    freeChapters?: number;

    // price: required when changing to PURCHASE type
    @ValidateIf((o) => o.accessType === BookAccessType.PURCHASE)
    @IsNumber({}, { message: 'price is required when accessType is PURCHASE' })
    @Min(1, { message: 'price must be greater than 0 for PURCHASE books' })
    @Type(() => Number)
    price?: number;

    @IsOptional()
    @IsBoolean()
    requireLogin?: boolean;

    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    categoryIds?: number[];

    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    authorIds?: number[];

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
