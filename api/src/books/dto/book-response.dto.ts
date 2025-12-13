import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Harry Potter and the Philosopher Stone' })
  title: string;

  @ApiProperty({ example: 'harry-potter-and-the-philosopher-stone' })
  slug: string;

  @ApiPropertyOptional({ example: 'A young wizard discovers his magical heritage...' })
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  coverImage?: string;

  @ApiProperty({ example: 20 })
  totalChapters: number;

  @ApiProperty({ example: 3 })
  freeChapters: number;

  @ApiPropertyOptional({ example: '9.99' })
  price?: string;

  @ApiProperty({ example: false })
  requireLogin: boolean;

  @ApiProperty({ example: 'PUBLISHED', enum: ['DRAFT', 'PROCESSING', 'PUBLISHED', 'FAILED'] })
  status: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1250, description: 'Total view count' })
  viewCount: number;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  updatedAt: Date;
}
