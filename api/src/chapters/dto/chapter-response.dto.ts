import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChapterResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  bookId: number;

  @ApiProperty({ example: 'Chapter 1: The Boy Who Lived' })
  title: string;

  @ApiProperty({ example: 'chapter-1-the-boy-who-lived' })
  slug: string;

  @ApiProperty({ example: 1 })
  order: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  updatedAt: Date;
}

export class ChapterDetailResponseDto extends ChapterResponseDto {
  @ApiPropertyOptional({ example: '<p>Content of the chapter...</p>' })
  content?: string;
}
