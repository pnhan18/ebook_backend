import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Book, Prisma, BookStatus } from '@prisma/client';
import {
  IBooksRepository,
  FindAllOptions,
  FindAllResult,
  ViewHistoryResult,
} from '../interfaces/books-repository.interface';

@Injectable()
export class BooksRepository implements IBooksRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: Prisma.BookCreateInput): Promise<Book> {
    return this.prisma.book.create({ data });
  }

  private buildWhereClause(options: FindAllOptions): Prisma.BookWhereInput {
    const where: Prisma.BookWhereInput = {};

    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options.categoryId) {
      where.categories = { some: { categoryId: options.categoryId } };
    }

    if (options.authorId) {
      where.authors = { some: { authorId: options.authorId } };
    }

    return where;
  }

  async findAll(options: FindAllOptions): Promise<FindAllResult> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(options);

    // Build orderBy
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    const orderBy: Prisma.BookOrderByWithRelationInput = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          status: true,
          isActive: true,
          totalChapters: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
          authors: {
            select: { author: { select: { id: true, name: true } } },
          },
          categories: {
            select: { category: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.book.count({ where }),
    ]);

    return { data: data as unknown as Book[], total };
  }

  async findAllPublic(options: FindAllOptions): Promise<FindAllResult> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const baseWhere: Prisma.BookWhereInput = {
      status: BookStatus.PUBLISHED,
      isActive: true,
    };

    if (options.search) {
      baseWhere.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    // Categories by slugs (multiple)
    if (options.categorySlugs?.length) {
      baseWhere.categories = {
        some: { category: { slug: { in: options.categorySlugs } } },
      };
    }

    // Authors by slugs (multiple)
    if (options.authorSlugs?.length) {
      baseWhere.authors = {
        some: { author: { slug: { in: options.authorSlugs } } },
      };
    }

    // Access type filter
    if (options.accessType) {
      (baseWhere as any).accessType = options.accessType;
    }

    // Price filter for purchase books
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      baseWhere.price = { gt: 0 };
      if (options.minPrice !== undefined) {
        (baseWhere.price as Prisma.IntNullableFilter).gte = options.minPrice;
      }
      if (options.maxPrice !== undefined) {
        (baseWhere.price as Prisma.IntNullableFilter).lte = options.maxPrice;
      }
    }

    // Build orderBy
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    const orderBy: Prisma.BookOrderByWithRelationInput = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.book.findMany({
        where: baseWhere,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          coverImage: true,
          totalChapters: true,
          freeChapters: true,
          price: true,
          accessType: true as any,
          viewCount: true,
          createdAt: true,
          authors: {
            select: { author: { select: { id: true, name: true, slug: true } } },
          },
          categories: {
            select: { category: { select: { id: true, name: true, slug: true } } },
          },
        } as any,
      }),
      this.prisma.book.count({ where: baseWhere }),
    ]);

    return { data: data as unknown as Book[], total };
  }

  async findById(id: number): Promise<Book | null> {
    return this.prisma.book.findUnique({
      where: { id },
      include: {
        categories: { include: { category: true } },
        authors: { include: { author: true } },
      },
    });
  }

  async findBySlug(slug: string): Promise<Book | null> {
    return this.prisma.book.findUnique({
      where: { slug },
      include: {
        categories: { include: { category: true } },
        authors: { include: { author: true } },
      },
    });
  }

  async findByIdWithChapters(id: number) {
    return this.prisma.book.findUnique({
      where: { id },
      include: {
        chapters: { select: { contentKey: true } },
      },
    });
  }

  async update(id: number, data: Prisma.BookUpdateInput): Promise<Book> {
    return this.prisma.book.update({ where: { id }, data });
  }

  async delete(id: number): Promise<Book> {
    return this.prisma.book.delete({ where: { id } });
  }

  async updateStatus(id: number, status: string): Promise<Book> {
    return this.prisma.book.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async setCategories(bookId: number, categoryIds: number[]): Promise<void> {
    await this.prisma.bookCategory.deleteMany({ where: { bookId } });
    if (categoryIds.length > 0) {
      await this.prisma.bookCategory.createMany({
        data: categoryIds.map((categoryId) => ({ bookId, categoryId })),
      });
    }
  }

  async setAuthors(bookId: number, authorIds: number[]): Promise<void> {
    await this.prisma.bookAuthor.deleteMany({ where: { bookId } });
    if (authorIds.length > 0) {
      await this.prisma.bookAuthor.createMany({
        data: authorIds.map((authorId) => ({ bookId, authorId })),
      });
    }
  }

  async recordView(
    bookId: number,
    userId?: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<boolean> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Check if already viewed in last 24h (by user or IP)
    const existingView = await this.prisma.bookView.findFirst({
      where: {
        bookId,
        viewedAt: { gte: oneDayAgo },
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(ipAddress ? [{ ipAddress, userId: null }] : []),
        ],
      },
    });

    if (existingView) {
      return false;
    }

    // Record new view and increment counter
    await this.prisma.$transaction([
      this.prisma.bookView.create({
        data: { bookId, userId, ipAddress, userAgent },
      }),
      this.prisma.book.update({
        where: { id: bookId },
        data: { viewCount: { increment: 1 } },
      }),
    ]);

    return true;
  }

  async getUserViewHistory(
    userId: number,
    page: number,
    limit: number,
  ): Promise<ViewHistoryResult> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.bookView.findMany({
        where: { userId },
        orderBy: { viewedAt: 'desc' },
        skip,
        take: limit,
        select: {
          bookId: true,
          viewedAt: true,
          book: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
            },
          },
        },
      }),
      this.prisma.bookView.count({ where: { userId } }),
    ]);

    return { data, total };
  }

  async getUserViewCount(userId: number): Promise<number> {
    return this.prisma.bookView.count({ where: { userId } });
  }

  async getViewCount(bookId: number): Promise<number> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { viewCount: true },
    });
    return book?.viewCount ?? 0;
  }

  private readonly publicBookSelect = {
    id: true,
    title: true,
    slug: true,
    description: true,
    coverImage: true,
    totalChapters: true,
    freeChapters: true,
    viewCount: true,
    price: true,
    authors: {
      select: { author: { select: { id: true, name: true, slug: true } } },
    },
    categories: {
      select: { category: { select: { id: true, name: true, slug: true } } },
    },
  };

  private readonly minimalBookSelect = {
    id: true,
    title: true,
    slug: true,
    coverImage: true,
    viewCount: true,
    price: true,
  };

  async findPopular(limit: number): Promise<Book[]> {
    const books = await this.prisma.book.findMany({
      where: {
        status: BookStatus.PUBLISHED,
        isActive: true,
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: {
        ...this.minimalBookSelect,
        authors: { select: { author: { select: { id: true, name: true } } } }
      },
    });

    return books as unknown as Book[];
  }

  async findTrending(days: number, limit: number): Promise<Book[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get book IDs with most views in the period (groupBy doesn't support relation filters)
    const trendingBooks = await this.prisma.bookView.groupBy({
      by: ['bookId'],
      where: {
        viewedAt: { gte: since },
      },
      _count: { bookId: true },
      orderBy: { _count: { bookId: 'desc' } },
      take: limit * 3, // Fetch more to account for filtering
    });

    if (trendingBooks.length === 0) {
      return [];
    }

    const bookIds = trendingBooks.map((b) => b.bookId);

    // Fetch books with status/isActive filter
    const books = await this.prisma.book.findMany({
      where: {
        id: { in: bookIds },
        status: BookStatus.PUBLISHED,
        isActive: true,
      },
      select: {
        ...this.minimalBookSelect,
        authors: { select: { author: { select: { id: true, name: true } } } }
      },
    });

    // Sort by trending order and limit
    const bookMap = new Map(books.map((b) => [b.id, b]));
    return bookIds
      .map((id) => bookMap.get(id))
      .filter(Boolean)
      .slice(0, limit) as unknown as Book[];
  }

  async findLatest(limit: number): Promise<Book[]> {
    const books = await this.prisma.book.findMany({
      where: {
        status: BookStatus.PUBLISHED,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        ...this.minimalBookSelect,
        description: true,
        categories: { select: { category: { select: { id: true, name: true } } } },
      },
    });

    return books as unknown as Book[];
  }
}
