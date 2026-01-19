import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { CacheTTL, CachePrefix } from './cache.constants';

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
}

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);

    constructor(private readonly redis: RedisService) { }

    // ==================== Core Methods ====================

    /**
     * Get value from cache
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const cached = await this.redis.get(key);
            if (!cached) return null;
            return JSON.parse(cached.toString()) as T;
        } catch (error) {
            this.logger.warn(`Cache get error for key ${key}: ${error.message}`);
            return null;
        }
    }

    /**
     * Set value to cache
     */
    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        try {
            const serialized = Buffer.from(JSON.stringify(value));
            await this.redis.set(key, serialized, ttl ?? CacheTTL.DEFAULT);
        } catch (error) {
            this.logger.warn(`Cache set error for key ${key}: ${error.message}`);
        }
    }

    /**
     * Delete a cache key
     */
    async del(key: string): Promise<void> {
        try {
            await this.redis.del(key);
        } catch (error) {
            this.logger.warn(`Cache del error for key ${key}: ${error.message}`);
        }
    }

    /**
     * Delete multiple keys by pattern
     * Note: Use with caution in production, KEYS command can be slow
     */
    async delByPattern(pattern: string): Promise<void> {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await Promise.all(keys.map((key) => this.redis.del(key)));
                this.logger.debug(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
            }
        } catch (error) {
            this.logger.warn(`Cache delByPattern error for pattern ${pattern}: ${error.message}`);
        }
    }

    /**
     * Cache-aside pattern wrapper
     * Gets from cache, if miss, executes factory function and caches result
     */
    async wrap<T>(
        key: string,
        factory: () => Promise<T>,
        options: CacheOptions = {},
    ): Promise<T> {
        // Try to get from cache
        const cached = await this.get<T>(key);
        if (cached !== null) {
            this.logger.debug(`Cache HIT: ${key}`);
            return cached;
        }

        // Cache miss - execute factory
        this.logger.debug(`Cache MISS: ${key}`);
        const result = await factory();

        // Cache the result (don't await to not block response)
        if (result !== null && result !== undefined) {
            this.set(key, result, options.ttl).catch(() => { });
        }

        return result;
    }

    // ==================== Book Cache Methods ====================

    /**
     * Build book detail cache key
     */
    bookDetailKey(slug: string): string {
        return `${CachePrefix.BOOK_DETAIL}:${slug}`;
    }

    /**
     * Build book list cache key
     */
    bookListKey(type: 'popular' | 'trending' | 'latest', modifier?: string): string {
        const prefix = {
            popular: CachePrefix.BOOK_LIST_POPULAR,
            trending: CachePrefix.BOOK_LIST_TRENDING,
            latest: CachePrefix.BOOK_LIST_LATEST,
        }[type];
        return modifier ? `${prefix}:${modifier}` : prefix;
    }

    /**
     * Build book by category cache key
     */
    bookCategoryKey(categoryId: number, page = 1, limit = 10): string {
        return `${CachePrefix.BOOK_LIST_CATEGORY}:${categoryId}:${page}:${limit}`;
    }

    /**
     * Build similar books cache key
     */
    bookSimilarKey(bookId: number): string {
        return `${CachePrefix.BOOK_SIMILAR}:${bookId}`;
    }

    /**
     * Invalidate book detail cache
     */
    async invalidateBookDetail(slug: string): Promise<void> {
        await this.del(this.bookDetailKey(slug));
    }

    /**
     * Invalidate all book list caches
     */
    async invalidateBookLists(): Promise<void> {
        await Promise.all([
            this.delByPattern(`${CachePrefix.BOOK_LIST_POPULAR}*`),
            this.delByPattern(`${CachePrefix.BOOK_LIST_TRENDING}*`),
            this.delByPattern(`${CachePrefix.BOOK_LIST_LATEST}*`),
            this.delByPattern(`${CachePrefix.BOOK_LIST_CATEGORY}*`),
            this.delByPattern('book:list:public:*'),
        ]);
    }

    /**
     * Invalidate all caches related to a book
     */
    async invalidateBook(slug: string, bookId?: number): Promise<void> {
        const promises: Promise<void>[] = [
            this.invalidateBookDetail(slug),
            this.invalidateBookLists(),
        ];

        if (bookId) {
            promises.push(this.del(this.bookSimilarKey(bookId)));
        }

        await Promise.all(promises);
    }

    // ==================== Category Cache Methods ====================

    /**
     * Categories cache key
     */
    categoriesKey(): string {
        return CachePrefix.CATEGORIES_ALL;
    }

    /**
     * Invalidate categories cache
     */
    async invalidateCategories(): Promise<void> {
        await this.del(this.categoriesKey());
        // Also invalidate book category lists
        await this.delByPattern(`${CachePrefix.BOOK_LIST_CATEGORY}*`);
    }

    // ==================== Author Cache Methods ====================

    /**
     * Authors cache key
     */
    authorsKey(): string {
        return CachePrefix.AUTHORS_ALL;
    }

    /**
     * Invalidate authors cache
     */
    async invalidateAuthors(): Promise<void> {
        await this.del(this.authorsKey());
    }

    // ==================== Banner Cache Methods ====================

    /**
     * Banners cache key
     */
    bannersKey(): string {
        return CachePrefix.BANNERS_ACTIVE;
    }

    /**
     * Invalidate banners cache
     */
    async invalidateBanners(): Promise<void> {
        await this.del(this.bannersKey());
    }

    // ==================== View Count Methods ====================

    /**
     * Build view count key
     */
    viewCountKey(bookId: number): string {
        return `${CachePrefix.BOOK_VIEWS}:${bookId}`;
    }

    /**
     * Increment view count in Redis (for buffering)
     * Returns the new count
     */
    async incrementViewCount(bookId: number): Promise<number> {
        try {
            const key = this.viewCountKey(bookId);
            return await this.redis.incr(key);
        } catch (error) {
            this.logger.warn(`View count increment error for book ${bookId}: ${error.message}`);
            return 0;
        }
    }

    /**
     * Get all buffered view counts
     */
    async getBufferedViewCounts(): Promise<Map<number, number>> {
        const counts = new Map<number, number>();
        try {
            const keys = await this.redis.keys(`${CachePrefix.BOOK_VIEWS}:*`);
            if (keys.length === 0) return counts;

            // Use mget for better performance
            const values = await this.redis.mget(keys);
            keys.forEach((key, index) => {
                const bookId = parseInt(key.split(':').pop() || '0', 10);
                const count = values[index] ? parseInt(values[index] as string, 10) : 0;
                if (bookId && count > 0) {
                    counts.set(bookId, count);
                }
            });
        } catch (error) {
            this.logger.warn(`Get buffered view counts error: ${error.message}`);
        }
        return counts;
    }

    /**
     * Clear buffered view count for a book
     */
    async clearViewCount(bookId: number): Promise<void> {
        await this.del(this.viewCountKey(bookId));
    }

    /**
     * Clear all buffered view counts
     */
    async clearAllViewCounts(): Promise<void> {
        await this.delByPattern(`${CachePrefix.BOOK_VIEWS}:*`);
    }
}
