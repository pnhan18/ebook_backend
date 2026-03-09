import { Type } from 'class-transformer';
import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { PaginationQueryDto } from '../../common';
import { BannerPosition } from '@prisma/client';

export class AdminQueryBannerDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BannerPosition)
  position?: BannerPosition;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class PublicQueryBannerDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BannerPosition)
  position?: BannerPosition;
}
