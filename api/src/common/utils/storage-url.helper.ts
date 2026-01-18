import { StorageService } from 'src/storage/storage.service';

/**
 * Helper to convert S3 keys to URLs in objects
 */
export class StorageUrlHelper {
  constructor(private readonly storageService: StorageService) { }

  /**
   * Convert a single S3 key to public URL
   */
  toPublicUrl(key: string | null | undefined): string | null {
    return this.storageService.getPublicUrl(key);
  }

  /**
   * Convert a single S3 key to presigned URL
   */
  async toPresignedUrl(key: string | null | undefined): Promise<string | null> {
    if (!key) return null;
    return this.storageService.getPresignedDownloadUrl(key);
  }

  /**
   * Transform an object, converting specified fields to public URLs (synchronous)
   */
  transformToPublicUrls<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[],
  ): T {
    const result = { ...data };

    for (const field of fields) {
      const value = data[field];
      if (typeof value === 'string' && value) {
        (result as any)[field] = this.storageService.getPublicUrl(value);
      }
    }

    return result;
  }

  /**
   * Transform an array of objects to public URLs (synchronous)
   */
  transformManyToPublicUrls<T extends Record<string, any>>(
    data: T[],
    fields: (keyof T)[],
  ): T[] {
    return data.map((item) => this.transformToPublicUrls(item, fields));
  }

  /**
   * Transform an object, converting specified fields to presigned URLs
   */
  async transformOne<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[],
  ): Promise<T> {
    const result = { ...data };

    for (const field of fields) {
      const value = data[field];
      if (typeof value === 'string' && value) {
        (result as any)[field] = await this.storageService.getPresignedDownloadUrl(value);
      }
    }

    return result;
  }

  /**
   * Transform an array of objects to presigned URLs
   */
  async transformMany<T extends Record<string, any>>(
    data: T[],
    fields: (keyof T)[],
  ): Promise<T[]> {
    return Promise.all(data.map((item) => this.transformOne(item, fields)));
  }
}
