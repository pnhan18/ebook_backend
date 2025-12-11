import { Type } from 'class-transformer';
import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { PaginationQueryDto } from '../../common';

export enum BookStatusFilter {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export class AdminQueryBookDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(BookStatusFilter)
  status?: BookStatusFilter;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  authorId?: number;
}

export class PublicQueryBookDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  authorId?: number;
}
