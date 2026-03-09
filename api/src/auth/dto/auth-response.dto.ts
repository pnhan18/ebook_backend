import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserInfoDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar?: string | null;

  @ApiProperty({ example: 'FREE', enum: ['FREE', 'PREMIUM'] })
  subscriptionPlan: string;

  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE', 'BANNED'] })
  status: string;

  @ApiProperty({ example: ['user'], type: [String] })
  roles: string[];
}

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ type: UserInfoDto })
  user: UserInfoDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation successful' })
  message: string;
}
