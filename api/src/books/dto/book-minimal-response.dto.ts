import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookMinimalResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Harry Potter' })
  title: string;

  @ApiProperty({ example: 'harry-potter' })
  slug: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  coverImage?: string;

  @ApiPropertyOptional({ example: 'A story about a young wizard...' })
  description?: string;

  @ApiProperty({ example: 1250 })
  viewCount: number;

  @ApiPropertyOptional({ example: '9.99' })
  price?: string;

  @ApiPropertyOptional({ example: true, description: 'Is book currently on promotion' })
  isOnPromotion?: boolean;

  @ApiPropertyOptional({ example: 20, description: 'Discount percentage (0 if no discount)' })
  discountPercent?: number;

  @ApiPropertyOptional({ example: '2026-01-31T23:59:59.000Z', description: 'Promotion end date' })
  promotionEndDate?: Date;
}
