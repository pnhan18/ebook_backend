import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BooksService } from '../books/books.service';

interface CachedRecommendation {
  book_id: number;
  score: number;
  source?: string;
  sources?: string[];
}

@Injectable()
export class RecommendationsService {
  private readonly bookSelect = {
    id: true,
    title: true,
    slug: true,
    coverImage: true,
    viewCount: true,
    authors: {
      include: { author: { select: { id: true, name: true, slug: true } } },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly booksService: BooksService,
  ) {}

  async getRecommendations(
    userId: number | null | undefined,
    limit: number = 10,
  ) {
    // Thử đọc từ Redis cache trước
    const cached = await this.getCachedRecommendations(userId ?? null);
    if (cached && cached.length > 0) {
      return this.hydrateBooks(cached.slice(0, limit));
    }

    // Fallback về SQL nếu chưa có cache
    if (!userId) {
      return this.getPopularBooks(limit);
    }

    const interactionCount = await this.booksService.getUserViewCount(userId);

    if (interactionCount < 5) {
      return this.getColdStartRecommendations(userId, limit);
    }

    return this.getSimpleRecommendations(userId, limit);
  }

  async getSimilarBooks(bookId: number, limit: number = 10) {
    // Thử đọc từ Redis cache trước
    const cached = await this.getCachedSimilarBooks(bookId);
    if (cached && cached.length > 0) {
      return this.hydrateBooks(cached.slice(0, limit));
    }

    // Fallback về SQL
    return this.getSimilarBooksFallback(bookId, limit);
  }

  // ============ Redis Cache Methods ============

  private async getCachedRecommendations(
    userId: number | null,
  ): Promise<CachedRecommendation[] | null> {
    try {
      const key =
        userId === null
          ? 'recommendation:popular'
          : `recommendation:user:${userId}`;

      const data = await this.redis.get(key);
      if (data) {
        // Worker dùng Python pickle, cần deserialize
        return this.deserializePickle(data);
      }
    } catch (error) {
      console.warn('Failed to get cached recommendations:', error);
    }
    return null;
  }

  private async getCachedSimilarBooks(
    bookId: number,
  ): Promise<CachedRecommendation[] | null> {
    try {
      const key = `recommendation:similar:${bookId}`;
      const data = await this.redis.get(key);
      if (data) {
        return this.deserializePickle(data);
      }
    } catch (error) {
      console.warn('Failed to get cached similar books:', error);
    }
    return null;
  }

  private deserializePickle(buffer: Buffer): CachedRecommendation[] | null {
    // Python pickle format - cần parse
    // Đơn giản hóa: dùng v8.deserialize nếu worker serialize bằng v8
    // Hoặc parse pickle format
    try {
      // Thử parse như JSON trước (nếu worker đổi sang JSON)
      const str = buffer.toString('utf-8');
      if (str.startsWith('[') || str.startsWith('{')) {
        return JSON.parse(str);
      }

      // Pickle format phức tạp, cần thư viện riêng
      // Tạm thời return null để fallback về SQL
      console.warn('Pickle format not supported in Node.js, using fallback');
      return null;
    } catch {
      return null;
    }
  }

  private async hydrateBooks(recommendations: CachedRecommendation[]) {
    const bookIds = recommendations.map((r) => r.book_id);

    const books = await this.prisma.book.findMany({
      where: {
        id: { in: bookIds },
        isActive: true,
        status: 'PUBLISHED',
      },
      select: this.bookSelect,
    });

    // Giữ nguyên thứ tự từ recommendations
    const bookMap = new Map(books.map((b) => [b.id, b]));
    return recommendations
      .map((r) => bookMap.get(r.book_id))
      .filter((b) => b !== undefined);
  }

  // ============ SQL Fallback Methods ============

  async getPopularBooks(limit: number = 10) {
    return this.prisma.book.findMany({
      where: {
        isActive: true,
        status: 'PUBLISHED',
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: this.bookSelect,
    });
  }

  private async getSimilarBooksFallback(bookId: number, limit: number) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        categories: { select: { categoryId: true } },
        authors: { select: { authorId: true } },
      },
    });

    if (!book) {
      return [];
    }

    const categoryIds = book.categories.map((c) => c.categoryId);
    const authorIds = book.authors.map((a) => a.authorId);

    return this.prisma.book.findMany({
      where: {
        id: { not: bookId },
        isActive: true,
        status: 'PUBLISHED',
        OR: [
          { categories: { some: { categoryId: { in: categoryIds } } } },
          { authors: { some: { authorId: { in: authorIds } } } },
        ],
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: this.bookSelect,
    });
  }

  private async getColdStartRecommendations(userId: number, limit: number) {
    const recentViews = await this.prisma.bookView.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
      take: 10,
      select: {
        book: {
          select: {
            categories: { select: { categoryId: true } },
          },
        },
      },
    });

    const viewedCategoryIds = [
      ...new Set(
        recentViews.flatMap((v) => v.book.categories.map((c) => c.categoryId)),
      ),
    ];

    const viewedBookIds = await this.prisma.bookView.findMany({
      where: { userId },
      select: { bookId: true },
      distinct: ['bookId'],
    });

    const excludeIds = viewedBookIds.map((v) => v.bookId);

    if (viewedCategoryIds.length === 0) {
      return this.getPopularBooks(limit);
    }

    const recommendations = await this.prisma.book.findMany({
      where: {
        id: { notIn: excludeIds },
        isActive: true,
        status: 'PUBLISHED',
        categories: { some: { categoryId: { in: viewedCategoryIds } } },
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: this.bookSelect,
    });

    if (recommendations.length < limit) {
      const popular = await this.prisma.book.findMany({
        where: {
          id: { notIn: [...excludeIds, ...recommendations.map((r) => r.id)] },
          isActive: true,
          status: 'PUBLISHED',
        },
        orderBy: { viewCount: 'desc' },
        take: limit - recommendations.length,
        select: this.bookSelect,
      });

      recommendations.push(...popular);
    }

    return recommendations;
  }

  private async getSimpleRecommendations(userId: number, limit: number) {
    const userViews = await this.prisma.bookView.findMany({
      where: { userId },
      select: { bookId: true },
      distinct: ['bookId'],
    });

    const viewedBookIds = userViews.map((v) => v.bookId);

    if (viewedBookIds.length === 0) {
      return this.getPopularBooks(limit);
    }

    const similarUserViews = await this.prisma.bookView.findMany({
      where: {
        bookId: { in: viewedBookIds },
        userId: { not: userId },
      },
      select: { userId: true },
      distinct: ['userId'],
      take: 50,
    });

    const similarUserIds = similarUserViews
      .map((v) => v.userId)
      .filter((id): id is number => id !== null);

    if (similarUserIds.length === 0) {
      return this.getColdStartRecommendations(userId, limit);
    }

    const candidateBooks = await this.prisma.bookView.groupBy({
      by: ['bookId'],
      where: {
        userId: { in: similarUserIds },
        bookId: { notIn: viewedBookIds },
      },
      _count: { bookId: true },
      orderBy: { _count: { bookId: 'desc' } },
      take: limit,
    });

    const bookIds = candidateBooks.map((c) => c.bookId);

    return this.prisma.book.findMany({
      where: {
        id: { in: bookIds },
        isActive: true,
        status: 'PUBLISHED',
      },
      select: this.bookSelect,
    });
  }
}
