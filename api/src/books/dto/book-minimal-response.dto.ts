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

  @ApiProperty({ example: 1250 })
  viewCount: number;
}
