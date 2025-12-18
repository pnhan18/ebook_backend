import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Book, Prisma, BookStatus } from '@prisma/client';
import {
  IBooksRepository,
  FindAllOptions,
  FindAllResult,
} from '../interfaces/books-repository.interface';

@Injectable()
export class BooksRepository implements IBooksRepository {
  constructor(private readonly prisma: PrismaService) {}

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

    const [data, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          status: true,
          isActive: true,
          totalChapters: true,
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

    if (options.categoryId) {
      baseWhere.categories = { some: { categoryId: options.categoryId } };
    }

    if (options.authorId) {
      baseWhere.authors = { some: { authorId: options.authorId } };
    }

    const [data, total] = await Promise.all([
      this.prisma.book.findMany({
        where: baseWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          coverImage: true,
          totalChapters: true,
          freeChapters: true,
          price: true,
          authors: {
            select: { author: { select: { id: true, name: true, slug: true } } },
          },
          categories: {
            select: { category: { select: { id: true, name: true, slug: true } } },
          },
        },
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
      return false; // Already viewed
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
  };

  async findPopular(limit: number): Promise<Book[]> {
    const books = await this.prisma.book.findMany({
      where: {
        status: BookStatus.PUBLISHED,
        isActive: true,
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: this.minimalBookSelect,
    });

    return books as unknown as Book[];
  }

  async findTrending(days: number, limit: number): Promise<Book[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get book IDs with most views in the period
    const trendingBooks = await this.prisma.bookView.groupBy({
      by: ['bookId'],
      where: {
        viewedAt: { gte: since },
        book: {
          status: BookStatus.PUBLISHED,
          isActive: true,
        },
      },
      _count: { bookId: true },
      orderBy: { _count: { bookId: 'desc' } },
      take: limit,
    });

    if (trendingBooks.length === 0) {
      return [];
    }

    const bookIds = trendingBooks.map((b) => b.bookId);

    // Fetch minimal book data
    const books = await this.prisma.book.findMany({
      where: { id: { in: bookIds } },
      select: this.minimalBookSelect,
    });

    // Sort by trending order
    const bookMap = new Map(books.map((b) => [b.id, b]));
    return bookIds.map((id) => bookMap.get(id)).filter(Boolean) as unknown as Book[];
  }

  async findLatest(limit: number): Promise<Book[]> {
    const books = await this.prisma.book.findMany({
      where: {
        status: BookStatus.PUBLISHED,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: this.minimalBookSelect,
    });

    return books as unknown as Book[];
  }
}
