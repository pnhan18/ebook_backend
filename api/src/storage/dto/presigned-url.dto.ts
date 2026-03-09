import { IsString, IsIn } from 'class-validator';

export type UploadType = 'book' | 'cover' | 'avatar';

export class GetPresignedUrlDto {
  @IsString()
  filename: string;

  @IsString()
  @IsIn(['book', 'cover', 'avatar'])
  type: UploadType;
}
