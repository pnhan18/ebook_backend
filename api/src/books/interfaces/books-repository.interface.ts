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

export interface IBooksRepository {
  create(data: Prisma.BookCreateInput): Promise<Book>;
  findAll(options: FindAllOptions): Promise<FindAllResult>;
  findAllPublic(options: FindAllOptions): Promise<FindAllResult>;
  findById(id: number): Promise<Book | null>;
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
  getViewCount(bookId: number): Promise<number>;
  findPopular(limit: number): Promise<Book[]>;
  findTrending(days: number, limit: number): Promise<Book[]>;
  findLatest(limit: number): Promise<Book[]>;
}
