import { StorageService } from 'src/storage/storage.service';

/**
 * Helper to convert S3 keys to presigned URLs in objects
 */
export class StorageUrlHelper {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Convert a single S3 key to presigned URL
   */
  async toUrl(key: string | null | undefined): Promise<string | null> {
    if (!key) return null;
    return this.storageService.getPresignedDownloadUrl(key);
  }

  /**
   * Transform an object, converting specified fields to URLs
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
   * Transform an array of objects
   */
  async transformMany<T extends Record<string, any>>(
    data: T[],
    fields: (keyof T)[],
  ): Promise<T[]> {
    return Promise.all(data.map((item) => this.transformOne(item, fields)));
  }
}
