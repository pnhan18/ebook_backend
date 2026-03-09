import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BannerResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Summer Sale' })
  title: string;

  @ApiPropertyOptional({ example: 'Get 50% off on all books' })
  description?: string;

  @ApiProperty({ example: 'https://example.com/banner.jpg' })
  imageUrl: string;

  @ApiPropertyOptional({ example: 'https://example.com/sale' })
  linkUrl?: string;

  @ApiProperty({ example: 'HOME_SLIDER', enum: ['HOME_SLIDER', 'HOME_POPUP', 'SIDEBAR_LEFT', 'SIDEBAR_RIGHT', 'HEADER', 'FOOTER'] })
  position: string;

  @ApiProperty({ example: 1 })
  order: number;

  @ApiPropertyOptional({ example: '2025-12-01T00:00:00.000Z' })
  startDate?: Date;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59.000Z' })
  endDate?: Date;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  updatedAt: Date;
}
