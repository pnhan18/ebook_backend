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
}

class UserSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar: string | null;
}

export class RatingResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 1 })
  bookId: number;

  @ApiProperty({ example: 5 })
  score: number;

  @ApiPropertyOptional({ example: 'Great book!' })
  review: string | null;

  @ApiProperty({ example: '2025-12-25T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-12-25T10:00:00.000Z' })
  updatedAt: Date;
}

export class RatingWithBookResponseDto extends RatingResponseDto {
  @ApiProperty({ type: BookSummaryDto })
  book: BookSummaryDto;
}

export class RatingWithUserResponseDto extends RatingResponseDto {
  @ApiProperty({ type: UserSummaryDto })
  user: UserSummaryDto;
}

export class RatingStatsResponseDto {
  @ApiProperty({ example: 4.5 })
  averageRating: number;

  @ApiProperty({ example: 100 })
  ratingCount: number;

  @ApiPropertyOptional({ type: RatingResponseDto })
  userRating?: RatingResponseDto | null;
}

class RatingDistributionDto {
  @ApiProperty({ example: 80 })
  5: number;

  @ApiProperty({ example: 40 })
  4: number;

  @ApiProperty({ example: 20 })
  3: number;

  @ApiProperty({ example: 5 })
  2: number;

  @ApiProperty({ example: 5 })
  1: number;
}

export class RatingSummaryResponseDto {
  @ApiProperty({ example: 4.2 })
  averageRating: number;

  @ApiProperty({ example: 150 })
  ratingCount: number;

  @ApiProperty({ type: RatingDistributionDto })
  distribution: RatingDistributionDto;
}
