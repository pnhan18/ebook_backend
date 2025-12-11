import { Category, Prisma } from '@prisma/client';

export interface FindAllOptions {
  page: number;
  limit: number;
}

export interface FindAllResult {
  data: Category[];
  total: number;
}

export interface ICategoriesRepository {
  create(data: Prisma.CategoryCreateInput): Promise<Category>;
  findAll(options: FindAllOptions): Promise<FindAllResult>;
  findById(id: number): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  findByParentId(parentId: number): Promise<Category[]>;
  update(id: number, data: Prisma.CategoryUpdateInput): Promise<Category>;
  delete(id: number): Promise<Category>;
}
