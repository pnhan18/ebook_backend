import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Fiction' })
  name: string;

  @ApiProperty({ example: 'fiction' })
  slug: string;

  @ApiPropertyOptional({ example: 'Fiction books category' })
  description?: string;

  @ApiPropertyOptional({ example: null })
  parentId?: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  updatedAt: Date;
}
