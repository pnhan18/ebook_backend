import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { CategoriesRepository } from './repositories/categories.repository';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { PaginationQueryDto, PaginatedResponseDto, generateSlug } from '../common';
import { CategoriesSearchService } from './search/categories-search.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly categoriesSearchService: CategoriesSearchService,
  ) {}

  private async generateUniqueSlug(name: string): Promise<string> {
    let slug = generateSlug(name);
    let counter = 1;

    while (await this.categoriesRepository.findBySlug(slug)) {
      slug = `${generateSlug(name)}-${counter}`;
      counter++;
    }

    return slug;
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const slug = createCategoryDto.slug || (await this.generateUniqueSlug(createCategoryDto.name));

    if (createCategoryDto.slug) {
      const existingCategory = await this.categoriesRepository.findBySlug(slug);
      if (existingCategory) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    if (createCategoryDto.parentId) {
      const parent = await this.categoriesRepository.findById(createCategoryDto.parentId);
      if (!parent) {
        throw new BadRequestException('Parent category not found');
      }
    }

    const category = await this.categoriesRepository.create({ ...createCategoryDto, slug });
    await this.categoriesSearchService.indexCategory(category);
    return category;
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponseDto<Category>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.categoriesRepository.findAll({ page, limit });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoriesRepository.findBySlug(slug);
    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }
    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id);

    if (updateCategoryDto.slug) {
      const existingCategory = await this.categoriesRepository.findBySlug(updateCategoryDto.slug);
      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    if (updateCategoryDto.parentId) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }
      const parent = await this.categoriesRepository.findById(updateCategoryDto.parentId);
      if (!parent) {
        throw new BadRequestException('Parent category not found');
      }
    }

    const category = await this.categoriesRepository.update(id, updateCategoryDto);
    await this.categoriesSearchService.updateCategory(category);
    return category;
  }

  async remove(id: number): Promise<Category> {
    await this.findOne(id);
    const category = await this.categoriesRepository.delete(id);
    await this.categoriesSearchService.deleteCategory(id);
    return category;
  }
}
