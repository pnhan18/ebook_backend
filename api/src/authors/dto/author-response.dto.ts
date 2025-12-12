import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthorResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'J.K. Rowling' })
  name: string;

  @ApiProperty({ example: 'jk-rowling' })
  slug: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar?: string;

  @ApiPropertyOptional({ example: 'British author best known for Harry Potter series' })
  bio?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  updatedAt: Date;
}
