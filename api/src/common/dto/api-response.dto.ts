import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Request successful' })
  message: string;

  @ApiPropertyOptional()
  data?: T;

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/endpoint' })
  path: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Error message' })
  message: string;

  @ApiPropertyOptional({ example: 'BadRequestException' })
  error?: string;

  @ApiPropertyOptional({ type: [String], example: ['field must be a string'] })
  errors?: string[];

  @ApiProperty({ example: '2025-12-12T10:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/endpoint' })
  path: string;
}
