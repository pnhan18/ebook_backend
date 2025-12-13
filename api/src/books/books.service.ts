import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Book, BookStatus } from '@prisma/client';
import { BooksRepository } from './repositories/books.repository';
import { StorageService } from 'src/storage/storage.service';
import { QueueService } from 'src/queue/queue.service';
import { CreateBookDto, UpdateBookDto, AdminQueryBookDto, PublicQueryBookDto } from './dto';
import { PaginatedResponseDto, generateSlug, StorageUrlHelper } from '../common';

@Injectable()
export class BooksService {
  private readonly urlHelper: StorageUrlHelper;

  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
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

    const book = await this.booksRepository.create({
      ...bookData,
      slug,
    });

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
    return createdBook as Book;
  }

  async findAllPublic(query: PublicQueryBookDto): Promise<PaginatedResponseDto<Book>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.booksRepository.findAllPublic({
      page,
      limit,
      search: query.search,
      categoryId: query.categoryId,
      authorId: query.authorId,
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
    await this.findOne(id);

    if (updateBookDto.slug) {
      const existing = await this.booksRepository.findBySlug(updateBookDto.slug);
      if (existing && existing.id !== id) {
        throw new ConflictException('Book with this slug already exists');
      }
    }

    const { categoryIds, authorIds, ...bookData } = updateBookDto;

    await this.booksRepository.update(id, bookData);

    if (categoryIds !== undefined) {
      await this.booksRepository.setCategories(id, categoryIds);
    }

    if (authorIds !== undefined) {
      await this.booksRepository.setAuthors(id, authorIds);
    }

    const updatedBook = await this.booksRepository.findById(id);
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

    return this.booksRepository.delete(id);
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
}
