import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BookSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'The Great Gatsby' })
  title: string;

  @ApiProperty({ example: 'the-great-gatsby' })
  slug: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  coverImage: string | null;

  @ApiPropertyOptional({ example: 'A story about...' })
  description: string | null;
}

export class FavoriteResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 1 })
  bookId: number;

  @ApiProperty({ type: BookSummaryDto })
  book: BookSummaryDto;

  @ApiProperty({ example: '2025-12-25T10:00:00.000Z' })
  createdAt: Date;
}

export class FavoriteStatusResponseDto {
  @ApiProperty({ example: true })
  isFavorited: boolean;

  @ApiProperty({ example: 100 })
  totalFavorites: number;
}
