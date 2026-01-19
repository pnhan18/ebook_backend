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
import { CacheService } from '../cache/cache.service';
import { CacheTTL } from '../cache/cache.constants';
import { PromotionsService } from '../promotions/promotions.service';

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
    private readonly cacheService: CacheService,
    private readonly promotionsService: PromotionsService,
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

  private async applyPromotionToBook(book: any) {
    if (!book) return book;
    // Only apply promotion if book has a price (PURCHASE type)
    if (book.price && Number(book.price) > 0) {
      const priceInfo = await this.promotionsService.calculateBookPrice(book);

      let discountPercent = 0;
      let isOnPromotion = false;
      let promotionEndDate: Date | null = null;

      if (priceInfo.promotion && priceInfo.discountAmount > 0) {
        isOnPromotion = true;
        promotionEndDate = priceInfo.promotion.endDate;

        if (priceInfo.promotion.type === 'PERCENTAGE') {
          discountPercent = Number(priceInfo.promotion.value);
        } else {
          // Calculate percentage from fixed amount
          discountPercent = Math.round((priceInfo.discountAmount / Number(book.price)) * 100);
        }
      }

      return {
        ...book,
        price: Number(book.price),
        isOnPromotion,
        discountPercent,
        promotionEndDate,
      };
    }
    return {
      ...book,
      isOnPromotion: false,
      discountPercent: 0,
      promotionEndDate: null,
    };
  }

  /**
   * Batch apply promotions to multiple books (performance optimized - 1 DB query)
   */
  private async applyPromotionsToBooks(books: any[]) {
    if (books.length === 0) return [];

    // Filter books with price for batch processing
    const booksWithPrice = books.filter(b => b.price && Number(b.price) > 0);
    const booksWithoutPrice = books.filter(b => !b.price || Number(b.price) <= 0);

    // Get all promotion data in ONE query
    const priceInfos = await this.promotionsService.calculateBookPricesBatch(booksWithPrice);

    // Create a map for quick lookup
    const priceInfoMap = new Map(priceInfos.map(p => [p.bookId, p]));

    // Apply promotion data to books
    const result = books.map(book => {
      if (!book.price || Number(book.price) <= 0) {
        return {
          ...book,
          isOnPromotion: false,
          discountPercent: 0,
          promotionEndDate: null,
        };
      }

      const priceInfo = priceInfoMap.get(book.id);
      if (!priceInfo || !priceInfo.promotion || priceInfo.discountAmount <= 0) {
        return {
          ...book,
          price: Number(book.price),
          isOnPromotion: false,
          discountPercent: 0,
          promotionEndDate: null,
        };
      }

      let discountPercent = 0;
      if (priceInfo.promotion.type === 'PERCENTAGE') {
        discountPercent = Number(priceInfo.promotion.value);
      } else {
        discountPercent = Math.round((priceInfo.discountAmount / Number(book.price)) * 100);
      }

      return {
        ...book,
        price: Number(book.price),
        isOnPromotion: true,
        discountPercent,
        promotionEndDate: priceInfo.promotion.endDate,
      };
    });

    return result;
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

    // Invalidate book list caches
    await this.cacheService.invalidateBookLists();

    return createdBook as Book;
  }

  async findAllPublic(query: PublicQueryBookDto): Promise<PaginatedResponseDto<Book>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    // If price filter is set, automatically filter purchase books only
    const hasPriceFilter = query.minPrice !== undefined || query.maxPrice !== undefined;
    const effectiveAccessType = hasPriceFilter ? 'PURCHASE' : query.accessType?.toUpperCase();

    // Build cache key from query params (EXCLUDING limit)
    const shouldCache = !query.search;
    let cacheKey: string | null = null;

    if (shouldCache) {
      const parts = [
        `page:${page}`,
        // limit is removed from key to allow dynamic expansion
      ];
      if (query.category) parts.push(`cat:${query.category}`);
      if (query.author) parts.push(`auth:${query.author}`);
      if (query.sortBy) parts.push(`sort:${query.sortBy}`);
      if (query.sortOrder) parts.push(`order:${query.sortOrder}`);
      if (effectiveAccessType) parts.push(`access:${effectiveAccessType}`);
      if (query.minPrice) parts.push(`min:${query.minPrice}`);
      if (query.maxPrice) parts.push(`max:${query.maxPrice}`);

      cacheKey = `book:list:public:${parts.join(':')}`;
    }

    // Try cache first
    if (cacheKey) {
      const cached = await this.cacheService.get<{ items: Book[]; total: number }>(cacheKey);

      // If cache exists and has enough items, return slice
      if (cached && cached.items.length >= limit) {
        const cachedItems = cached.items.slice(0, limit);
        const itemsWithPromo = await this.applyPromotionsToBooks(cachedItems);
        return new PaginatedResponseDto(
          itemsWithPromo,
          cached.total,
          page,
          limit
        );
      }
    }

    // Cache miss or not enough items -> Query DB
    const { data, total } = await this.booksRepository.findAllPublic({
      page,
      limit,
      search: query.search,
      categorySlugs: query.category,
      authorSlugs: query.author,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      accessType: effectiveAccessType,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
    });

    const transformedData = this.transformBooksUrls(data);
    const dataWithPromotions = await this.applyPromotionsToBooks(transformedData);
    const result = new PaginatedResponseDto(dataWithPromotions, total, page, limit);

    // Update cache with new data (items + total)
    if (cacheKey) {
      await this.cacheService.set(
        cacheKey,
        { items: transformedData, total },
        CacheTTL.BOOK_LIST_LATEST
      );
    }

    return result;
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
    const dataWithPromotions = await this.applyPromotionsToBooks(transformedData);
    const result = new PaginatedResponseDto(dataWithPromotions, total, page, limit);
    return result;
  }

  async findOne(id: number): Promise<Book> {
    const book = await this.booksRepository.findById(id);
    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }
    const transformed = this.transformBookUrls(book);
    return this.applyPromotionToBook(transformed);
  }

  async findBySlug(slug: string): Promise<Book> {
    const cacheKey = this.cacheService.bookDetailKey(slug);
    const cached = await this.cacheService.get<Book>(cacheKey);
    if (cached) return this.applyPromotionToBook(cached);

    const book = await this.booksRepository.findBySlug(slug);

    // Public: only return published and active books
    if (!book || book.status !== BookStatus.PUBLISHED || !book.isActive) {
      throw new NotFoundException(`Book with slug "${slug}" not found`);
    }

    const transformed = this.transformBookUrls(book);
    await this.cacheService.set(cacheKey, transformed, CacheTTL.BOOK_DETAIL);
    return this.applyPromotionToBook(transformed);
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

    // Invalidate caches
    await this.cacheService.invalidateBook(existingBook.slug, id);

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

    // Invalidate caches
    await this.cacheService.invalidateBook(bookWithChapters.slug, id);

    return deletedBook;
  }

  async findPopular(limit = 10): Promise<Book[]> {
    const cacheKey = this.cacheService.bookListKey('popular');
    let cachedBooks = await this.cacheService.get<Book[]>(cacheKey);

    // If cache exists and has enough items, return slice
    if (cachedBooks && cachedBooks.length >= limit) {
      return this.applyPromotionsToBooks(cachedBooks.slice(0, limit));
    }

    // If cache miss or not enough items, query DB with requested limit
    const books = await this.booksRepository.findPopular(limit);
    const transformedBooks = this.transformBooksUrls(books);

    // Update cache with new larger list
    await this.cacheService.set(cacheKey, transformedBooks, CacheTTL.BOOK_LIST_POPULAR);

    return this.applyPromotionsToBooks(transformedBooks);
  }

  async findTrending(period: 'week' | 'month' = 'week', limit = 10): Promise<Book[]> {
    const cacheKey = this.cacheService.bookListKey('trending', period);
    let cachedBooks = await this.cacheService.get<Book[]>(cacheKey);

    // If cache exists and has enough items, return slice
    if (cachedBooks && cachedBooks.length >= limit) {
      return this.applyPromotionsToBooks(cachedBooks.slice(0, limit));
    }

    // If cache miss or not enough items, query DB
    const days = period === 'week' ? 7 : 30;
    const books = await this.booksRepository.findTrending(days, limit);
    const transformedBooks = this.transformBooksUrls(books);

    // Update cache
    await this.cacheService.set(cacheKey, transformedBooks, CacheTTL.BOOK_LIST_TRENDING);

    return this.applyPromotionsToBooks(transformedBooks);
  }

  async findLatest(limit = 10): Promise<Book[]> {
    const cacheKey = this.cacheService.bookListKey('latest');
    let cachedBooks = await this.cacheService.get<Book[]>(cacheKey);

    // If cache exists and has enough items, return slice
    if (cachedBooks && cachedBooks.length >= limit) {
      return this.applyPromotionsToBooks(cachedBooks.slice(0, limit));
    }

    // If cache miss or not enough items, query DB
    const books = await this.booksRepository.findLatest(limit);
    const transformedBooks = this.transformBooksUrls(books);

    // Update cache
    await this.cacheService.set(cacheKey, transformedBooks, CacheTTL.BOOK_LIST_LATEST);

    return this.applyPromotionsToBooks(transformedBooks);
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
