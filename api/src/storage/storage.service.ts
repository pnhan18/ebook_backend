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
  private readonly publicBaseUrl: string;
  private readonly presignedUrlExpiresIn: number;
  private readonly bookContentExpiresIn: number;
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
    this.publicBaseUrl = this.configService.getOrThrow<string>('R2_PUBLIC_URL');
    this.presignedUrlExpiresIn = this.configService.get<number>('PRESIGNED_URL_EXPIRES_IN') || 300;
    this.bookContentExpiresIn = this.configService.get<number>('BOOK_CONTENT_EXPIRES_IN') || 7200;
  }

  getPublicUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    return `${this.publicBaseUrl}/${key}`;
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
        case 'audio':
          defaultExpiration = this.bookContentExpiresIn;
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
