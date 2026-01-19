import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Book, BookStatus } from '@prisma/client';
import { StorageService } from 'src/storage/storage.service';
import { QueueService } from 'src/queue/queue.service';
import { CreateBookDto, UpdateBookDto, AdminQueryBookDto, PublicQueryBookDto } from './dto';
import { PaginatedResponseDto, generateSlug, StorageUrlHelper } from '../common';
import { BooksSearchService } from './search/books-search.service';
import { ChapterReadEvent } from '../chapters/events/chapter-read.event';
import { RatingChangedEvent } from '../ratings/events/rating.events';
import type { IBooksRepository } from './interfaces/books-repository.interface';
import { ViewHistoryResult } from './interfaces/books-repository.interface';

// Access type enum (matches Prisma BookAccessType)
export enum AccessType {
  FREE = 'FREE',
  PURCHASE = 'PURCHASE',
  MEMBERSHIP = 'MEMBERSHIP',
}

@Injectable()
export class BooksService {
  private readonly urlHelper: StorageUrlHelper;

  constructor(
    @Inject('IBooksRepository')
    private readonly booksRepository: IBooksRepository,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
    private readonly booksSearchService: BooksSearchService,
  ) {
    this.urlHelper = new StorageUrlHelper(storageService);
  }

  private transformBookUrls<T extends { coverImage?: string | null }>(book: T): T {
    return this.urlHelper.transformToPublicUrls(book, ['coverImage']);
  }

  private transformBooksUrls<T extends { coverImage?: string | null }>(books: T[]): T[] {
    return this.urlHelper.transformManyToPublicUrls(books, ['coverImage']);
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    let slug = generateSlug(title);
    let counter = 1;

    while (await this.booksRepository.findBySlug(slug)) {
      slug = `${generateSlug(title)}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Calculate access type based on price and chapters
   */
  calculateAccessType(book: {
    price?: number | null | { toNumber?: () => number };
    totalChapters?: number;
    freeChapters?: number;
  }): AccessType {
    const price =
      typeof book.price === 'object' && book.price?.toNumber
        ? book.price.toNumber()
        : Number(book.price) || 0;

    const totalChapters = book.totalChapters ?? 0;
    const freeChapters = book.freeChapters ?? 0;

    if (price > 0) {
      return AccessType.PURCHASE;
    }
    if (freeChapters >= totalChapters || totalChapters === 0) {
      return AccessType.FREE;
    }
    return AccessType.MEMBERSHIP;
  }

  async create(createBookDto: CreateBookDto): Promise<Book> {
    const slug =
      createBookDto.slug || (await this.generateUniqueSlug(createBookDto.title));

    if (createBookDto.slug) {
      const existing = await this.booksRepository.findBySlug(slug);
      if (existing) {
        throw new ConflictException('Book with this slug already exists');
      }
    }

    const { categoryIds, authorIds, accessType, ...bookData } = createBookDto;

    const bookPayload: any = {
      ...bookData,
      slug,
      accessType: accessType,
    };

    if (accessType === 'FREE') {
      bookPayload.freeChapters = 0;
      bookPayload.price = null;
    } else if (accessType === 'MEMBERSHIP') {
      bookPayload.price = null;
    }

    const book = await this.booksRepository.create(bookPayload);

    if (categoryIds?.length) {
      await this.booksRepository.setCategories(book.id, categoryIds);
    }

    if (authorIds?.length) {
      await this.booksRepository.setAuthors(book.id, authorIds);
    }

    if (book.sourceKey) {
      await this.booksRepository.updateStatus(book.id, 'PROCESSING');
      await this.queueService.publishBookProcessing(book.id, book.sourceKey);
    }

    const createdBook = await this.booksRepository.findById(book.id);

    // Index to Elasticsearch
    if (createdBook) {
      await this.booksSearchService.indexBook(createdBook as any);
    }

    return createdBook as Book;
  }

  async findAllPublic(query: PublicQueryBookDto): Promise<PaginatedResponseDto<Book>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    // If price filter is set, automatically filter purchase books only
    const hasPriceFilter = query.minPrice !== undefined || query.maxPrice !== undefined;

    const { data, total } = await this.booksRepository.findAllPublic({
      page,
      limit,
      search: query.search,
      categorySlugs: query.category,
      authorSlugs: query.author,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      accessType: hasPriceFilter ? 'PURCHASE' : query.accessType?.toUpperCase(),
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
    });

    const transformedData = this.transformBooksUrls(data);
    return new PaginatedResponseDto(transformedData, total, page, limit);
  }

  async findAllAdmin(query: AdminQueryBookDto): Promise<PaginatedResponseDto<Book>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.booksRepository.findAll({
      page,
      limit,
      search: query.search,
      status: query.status as BookStatus,
      isActive: query.isActive,
      categoryId: query.categoryId,
      authorId: query.authorId,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    const transformedData = this.transformBooksUrls(data);
    return new PaginatedResponseDto(transformedData, total, page, limit);
  }

  async findOne(id: number): Promise<Book> {
    const book = await this.booksRepository.findById(id);
    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }
    return this.transformBookUrls(book);
  }

  async findBySlug(slug: string): Promise<Book> {
    const book = await this.booksRepository.findBySlug(slug);

    // Public: only return published and active books
    if (!book || book.status !== BookStatus.PUBLISHED || !book.isActive) {
      throw new NotFoundException(`Book with slug "${slug}" not found`);
    }

    return this.transformBookUrls(book);
  }

  async recordView(
    bookId: number,
    userId?: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.booksRepository.recordView(bookId, userId, ipAddress, userAgent);
  }

  @OnEvent('chapter.read')
  async handleChapterRead(payload: ChapterReadEvent) {
    await this.recordView(
      payload.bookId,
      payload.userId,
      payload.ipAddress,
      payload.userAgent,
    );
  }

  async getUserViewHistory(
    userId: number,
    page = 1,
    limit = 10,
  ): Promise<ViewHistoryResult> {
    return this.booksRepository.getUserViewHistory(userId, page, limit);
  }

  async getUserViewCount(userId: number): Promise<number> {
    return this.booksRepository.getUserViewCount(userId);
  }

  async update(id: number, updateBookDto: UpdateBookDto): Promise<Book> {
    const existingBook = await this.findOne(id);

    if (updateBookDto.slug) {
      const existing = await this.booksRepository.findBySlug(updateBookDto.slug);
      if (existing && existing.id !== id) {
        throw new ConflictException('Book with this slug already exists');
      }
    }

    const { categoryIds, authorIds, accessType, ...bookData } = updateBookDto;

    // Determine effective access type
    const effectiveAccessType = accessType ?? existingBook.accessType;

    // Apply business rules based on effective access type
    if (effectiveAccessType === 'FREE') {
      (bookData as any).freeChapters = 0;
      (bookData as any).price = null;
    } else if (effectiveAccessType === 'MEMBERSHIP') {
      (bookData as any).price = null;
    }

    if (accessType !== undefined) {
      (bookData as any).accessType = accessType;
    }

    await this.booksRepository.update(id, bookData);

    if (categoryIds !== undefined) {
      await this.booksRepository.setCategories(id, categoryIds);
    }

    if (authorIds !== undefined) {
      await this.booksRepository.setAuthors(id, authorIds);
    }

    const updatedBook = await this.booksRepository.findById(id);

    // Update in Elasticsearch
    if (updatedBook) {
      await this.booksSearchService.updateBook(updatedBook as any);
    }

    return updatedBook as Book;
  }

  async remove(id: number): Promise<Book> {
    const bookWithChapters = await this.booksRepository.findByIdWithChapters(id);
    if (!bookWithChapters) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

    // Delete chapter files from storage
    const deletePromises: Promise<void>[] = [];

    for (const chapter of bookWithChapters.chapters) {
      if (chapter.contentKey) {
        deletePromises.push(this.storageService.deleteObject(chapter.contentKey));
      }
    }

    // Delete book files
    if (bookWithChapters.sourceKey) {
      deletePromises.push(this.storageService.deleteObject(bookWithChapters.sourceKey));
    }
    if (bookWithChapters.coverImage) {
      deletePromises.push(this.storageService.deleteObject(bookWithChapters.coverImage));
    }

    // Execute all deletions in parallel
    await Promise.allSettled(deletePromises);

    const deletedBook = await this.booksRepository.delete(id);

    // Delete from Elasticsearch
    await this.booksSearchService.deleteBook(id);

    return deletedBook;
  }

  async findPopular(limit = 10): Promise<Book[]> {
    const books = await this.booksRepository.findPopular(limit);
    return this.transformBooksUrls(books);
  }

  async findTrending(period: 'week' | 'month' = 'week', limit = 10): Promise<Book[]> {
    const days = period === 'week' ? 7 : 30;
    const books = await this.booksRepository.findTrending(days, limit);
    return this.transformBooksUrls(books);
  }

  async findLatest(limit = 10): Promise<Book[]> {
    const books = await this.booksRepository.findLatest(limit);
    return this.transformBooksUrls(books);
  }

  async updateRatingStats(bookId: number, averageRating: number, ratingCount: number): Promise<void> {
    await this.booksRepository.update(bookId, { averageRating, ratingCount });
  }

  @OnEvent('rating.changed')
  async handleRatingChanged(event: RatingChangedEvent): Promise<void> {
    await this.booksRepository.update(event.bookId, {
      averageRating: event.averageRating,
      ratingCount: event.ratingCount,
    });
  }
}
