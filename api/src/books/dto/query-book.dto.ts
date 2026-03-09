import { Type, Transform } from 'class-transformer';
import { IsOptional, IsString, IsBoolean, IsEnum, IsArray, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export enum BookStatusFilter {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export enum BookSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TITLE = 'title',
  VIEW_COUNT = 'viewCount',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum BookAccessType {
  FREE = 'free',
  PURCHASE = 'purchase',
  MEMBERSHIP = 'membership',
}

export class AdminQueryBookDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by title or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: BookStatusFilter })
  @IsOptional()
  @IsEnum(BookStatusFilter)
  status?: BookStatusFilter;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @Type(() => Number)
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Filter by author ID' })
  @IsOptional()
  @Type(() => Number)
  authorId?: number;

  @ApiPropertyOptional({ enum: BookSortBy, default: BookSortBy.CREATED_AT })
  @IsOptional()
  @IsEnum(BookSortBy)
  sortBy?: BookSortBy;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}

export class PublicQueryBookDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by title or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by category slug(s)',
    type: [String],
    example: ['tieu-thuyet', 'trinh-tham'],
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @ApiPropertyOptional({
    description: 'Filter by author slug(s)',
    type: [String],
    example: ['nguyen-nhat-anh', 'to-hoai'],
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  author?: string[];

  @ApiPropertyOptional({ enum: BookSortBy, default: BookSortBy.CREATED_AT })
  @IsOptional()
  @IsEnum(BookSortBy)
  sortBy?: BookSortBy;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  @ApiPropertyOptional({
    description: 'Filter by access type: free (all chapters free), purchase (has price), membership (some chapters locked)',
    enum: BookAccessType,
  })
  @IsOptional()
  @IsEnum(BookAccessType)
  accessType?: BookAccessType;

  @ApiPropertyOptional({ description: 'Minimum price filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}
