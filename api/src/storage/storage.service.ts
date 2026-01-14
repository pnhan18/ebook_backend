import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly presignedUrlExpiresIn: number;
  private readonly chapterUrlExpiresIn: number;
  private readonly coverImageUrlExpiresIn: number;
  private readonly avatarUrlExpiresIn: number;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      endpoint: this.configService.getOrThrow<string>('R2_ENDPOINT'),
      region: 'auto',
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
    this.presignedUrlExpiresIn = this.configService.get<number>('PRESIGNED_URL_EXPIRES_IN') || 300;
    this.chapterUrlExpiresIn = this.configService.get<number>('CHAPTER_URL_EXPIRES_IN') || 7200;
    this.coverImageUrlExpiresIn = this.configService.get<number>('COVER_IMAGE_URL_EXPIRES_IN') || 3600;
    this.avatarUrlExpiresIn = this.configService.get<number>('AVATAR_URL_EXPIRES_IN') || 3600;
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      epub: 'application/epub+zip',
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    return map[ext || ''] || 'application/octet-stream';
  }

  async getPresignedUploadUrl(
    folder: string,
    filename: string,
    expiresIn = 300,
  ): Promise<{ key: string; uploadUrl: string }> {
    const ext = filename.split('.').pop() || 'bin';
    const key = `${folder}/${randomUUID()}.${ext}`;
    const contentType = this.getContentType(filename);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return { key, uploadUrl };
  }

  async getPresignedDownloadUrl(key: string, expiresIn?: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    // Determine expiration based on key path if not explicitly provided
    let defaultExpiration = this.presignedUrlExpiresIn;
    
    if (!expiresIn) {
      const folder = key.split('/')[0];
      
      switch (folder) {
        case 'chapters':
          defaultExpiration = this.chapterUrlExpiresIn;
          break;
        case 'covers':
          defaultExpiration = this.coverImageUrlExpiresIn;
          break;
        case 'avatars':
          defaultExpiration = this.avatarUrlExpiresIn;
          break;
        default:
          defaultExpiration = this.presignedUrlExpiresIn;
      }
    }

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresIn ?? defaultExpiration,
    });
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }
}
