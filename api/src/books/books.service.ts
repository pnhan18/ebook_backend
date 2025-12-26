import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Book, BookStatus } from '@prisma/client';
import { BooksRepository } from './repositories/books.repository';
import { StorageService } from 'src/storage/storage.service';
import { QueueService } from 'src/queue/queue.service';
import { CreateBookDto, UpdateBookDto, AdminQueryBookDto, PublicQueryBookDto } from './dto';
import { PaginatedResponseDto, generateSlug, StorageUrlHelper } from '../common';
import { BooksSearchService } from './search/books-search.service';
import { RatingChangedEvent } from '../ratings/events/rating.events';

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
    private readonly booksRepository: BooksRepository,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
    private readonly booksSearchService: BooksSearchService,
  ) {
    this.urlHelper = new StorageUrlHelper(storageService);
  }

  private async transformBookUrls<T extends { coverImage?: string | null }>(book: T): Promise<T> {
    return this.urlHelper.transformOne(book, ['coverImage']);
  }

  private async transformBooksUrls<T extends { coverImage?: string | null }>(books: T[]): Promise<T[]> {
    return this.urlHelper.transformMany(books, ['coverImage']);
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

    const { categoryIds, authorIds, ...bookData } = createBookDto;

    // Calculate accessType (totalChapters defaults to 0 for new books)
    const accessType = this.calculateAccessType({
      price: bookData.price,
      totalChapters: 0,
      freeChapters: bookData.freeChapters ?? 0,
    });

    const book = await this.booksRepository.create({
      ...bookData,
      slug,
      accessType: accessType,
    } as any);

    if (categoryIds?.length) {
      await this.booksRepository.setCategories(book.id, categoryIds);
    }

    if (authorIds?.length) {
      await this.booksRepository.setAuthors(book.id, authorIds);
    }

    // Send to worker for processing if sourceKey exists
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

    const transformedData = await this.transformBooksUrls(data);
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
    const transformedData = await this.transformBooksUrls(data);
    return new PaginatedResponseDto(transformedData, total, page, limit);
  }

  async findOne(id: number): Promise<Book> {
    const book = await this.booksRepository.findById(id);
    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }
    return this.transformBookUrls(book);
  }

  async findBySlug(
    slug: string,
    viewContext?: { userId?: number; ipAddress?: string; userAgent?: string },
  ): Promise<Book> {
    const book = await this.booksRepository.findBySlug(slug);

    // Public: only return published and active books
    if (!book || book.status !== BookStatus.PUBLISHED || !book.isActive) {
      throw new NotFoundException(`Book with slug "${slug}" not found`);
    }

    // Record view if context provided
    if (viewContext) {
      await this.booksRepository.recordView(
        book.id,
        viewContext.userId,
        viewContext.ipAddress,
        viewContext.userAgent,
      );
    }

    return this.transformBookUrls(book);
  }

  async update(id: number, updateBookDto: UpdateBookDto): Promise<Book> {
    const existingBook = await this.findOne(id);

    if (updateBookDto.slug) {
      const existing = await this.booksRepository.findBySlug(updateBookDto.slug);
      if (existing && existing.id !== id) {
        throw new ConflictException('Book with this slug already exists');
      }
    }

    const { categoryIds, authorIds, ...bookData } = updateBookDto;

    // Recalculate accessType if relevant fields changed
    const needsAccessTypeUpdate =
      bookData.price !== undefined || bookData.freeChapters !== undefined;

    if (needsAccessTypeUpdate) {
      const accessType = this.calculateAccessType({
        price: bookData.price ?? existingBook.price,
        totalChapters: existingBook.totalChapters,
        freeChapters: bookData.freeChapters ?? existingBook.freeChapters,
      });
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
