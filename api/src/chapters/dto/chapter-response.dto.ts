import { ApiProperty } from '@nestjs/swagger';

export class ChapterResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Chapter 1: The Boy Who Lived' })
  title: string;

  @ApiProperty({ example: 'chapter-1-the-boy-who-lived' })
  slug: string;

  @ApiProperty({ example: 1 })
  order: number;
}

export class ChapterDetailResponseDto extends ChapterResponseDto {
  @ApiProperty({ example: 1 })
  bookId: number;

  @ApiProperty({ example: 'text/html' })
  contentType: string | null;

  @ApiProperty({ example: 12345 })
  contentSize: number | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: true, description: 'Whether user has access to read this chapter' })
  hasAccess: boolean;

  @ApiProperty({
    example: 'https://storage.example.com/chapters/abc123?signature=...',
    description: 'Presigned URL (expires in 5 minutes), null if no access',
    nullable: true,
  })
  contentUrl: string | null;
}
