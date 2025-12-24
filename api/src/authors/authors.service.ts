import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Author } from '@prisma/client';
import { AuthorsRepository } from './repositories/authors.repository';
import { StorageService } from 'src/storage/storage.service';
import { CreateAuthorDto, UpdateAuthorDto } from './dto';
import { PaginationQueryDto, PaginatedResponseDto, generateSlug, StorageUrlHelper } from '../common';
import { AuthorsSearchService } from './search/authors-search.service';

@Injectable()
export class AuthorsService {
  private readonly urlHelper: StorageUrlHelper;

  constructor(
    private readonly authorsRepository: AuthorsRepository,
    private readonly storageService: StorageService,
    private readonly authorsSearchService: AuthorsSearchService,
  ) {
    this.urlHelper = new StorageUrlHelper(storageService);
  }

  private async transformAuthorUrls<T extends { avatar?: string | null }>(author: T): Promise<T> {
    return this.urlHelper.transformOne(author, ['avatar']);
  }

  private async transformAuthorsUrls<T extends { avatar?: string | null }>(authors: T[]): Promise<T[]> {
    return this.urlHelper.transformMany(authors, ['avatar']);
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    let slug = generateSlug(name);
    let counter = 1;

    while (await this.authorsRepository.findBySlug(slug)) {
      slug = `${generateSlug(name)}-${counter}`;
      counter++;
    }

    return slug;
  }

  async create(createAuthorDto: CreateAuthorDto): Promise<Author> {
    const slug = createAuthorDto.slug || (await this.generateUniqueSlug(createAuthorDto.name));

    if (createAuthorDto.slug) {
      const existingAuthor = await this.authorsRepository.findBySlug(slug);
      if (existingAuthor) {
        throw new ConflictException('Author with this slug already exists');
      }
    }

    const author = await this.authorsRepository.create({ ...createAuthorDto, slug });
    await this.authorsSearchService.indexAuthor(author);
    return author;
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponseDto<Author>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.authorsRepository.findAll({ page, limit });
    const transformedData = await this.transformAuthorsUrls(data);
    return new PaginatedResponseDto(transformedData, total, page, limit);
  }

  async findOne(id: number): Promise<Author> {
    const author = await this.authorsRepository.findById(id);
    if (!author) {
      throw new NotFoundException(`Author with ID ${id} not found`);
    }
    return this.transformAuthorUrls(author);
  }

  async findBySlug(slug: string): Promise<Author> {
    const author = await this.authorsRepository.findBySlug(slug);
    if (!author) {
      throw new NotFoundException(`Author with slug "${slug}" not found`);
    }
    return this.transformAuthorUrls(author);
  }

  async update(id: number, updateAuthorDto: UpdateAuthorDto): Promise<Author> {
    await this.findOne(id);

    if (updateAuthorDto.slug) {
      const existingAuthor = await this.authorsRepository.findBySlug(updateAuthorDto.slug);
      if (existingAuthor && existingAuthor.id !== id) {
        throw new ConflictException('Author with this slug already exists');
      }
    }

    const author = await this.authorsRepository.update(id, updateAuthorDto);
    await this.authorsSearchService.updateAuthor(author);
    return author;
  }

  async remove(id: number): Promise<Author> {
    await this.findOne(id);
    const author = await this.authorsRepository.delete(id);
    await this.authorsSearchService.deleteAuthor(id);
    return author;
  }
}
