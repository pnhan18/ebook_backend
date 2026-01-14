import { Book, Prisma, BookStatus } from '@prisma/client';

export interface FindAllOptions {
  page: number;
  limit: number;
  search?: string;
  status?: BookStatus;
  isActive?: boolean;
  categoryId?: number;
  authorId?: number;
  categorySlugs?: string[];
  authorSlugs?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  accessType?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface FindAllResult {
  data: Book[];
  total: number;
}

export interface ViewHistoryItem {
  bookId: number;
  viewedAt: Date;
  book: {
    id: number;
    title: string;
    slug: string;
    coverImage: string | null;
  };
}

export interface ViewHistoryResult {
  data: ViewHistoryItem[];
  total: number;
}

export interface IBooksRepository {
  create(data: Prisma.BookCreateInput): Promise<Book>;
  findAll(options: FindAllOptions): Promise<FindAllResult>;
  findAllPublic(options: FindAllOptions): Promise<FindAllResult>;
  findById(id: number): Promise<Book | null>;
  findByIdWithChapters(id: number): Promise<(Book & { chapters: { contentKey: string | null }[] }) | null>;
  findBySlug(slug: string): Promise<Book | null>;
  update(id: number, data: Prisma.BookUpdateInput): Promise<Book>;
  delete(id: number): Promise<Book>;
  updateStatus(id: number, status: string): Promise<Book>;
  setCategories(bookId: number, categoryIds: number[]): Promise<void>;
  setAuthors(bookId: number, authorIds: number[]): Promise<void>;
  recordView(
    bookId: number,
    userId?: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<boolean>;
  getUserViewHistory(
    userId: number,
    page: number,
    limit: number,
  ): Promise<ViewHistoryResult>;
  getUserViewCount(userId: number): Promise<number>;
  getViewCount(bookId: number): Promise<number>;
  findPopular(limit: number): Promise<Book[]>;
  findTrending(days: number, limit: number): Promise<Book[]>;
  findLatest(limit: number): Promise<Book[]>;
}
