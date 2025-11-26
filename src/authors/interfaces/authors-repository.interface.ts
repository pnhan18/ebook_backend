import { Author, Prisma } from '@prisma/client';

export interface FindAllOptions {
  page: number;
  limit: number;
}

export interface FindAllResult {
  data: Author[];
  total: number;
}

export interface IAuthorsRepository {
  create(data: Prisma.AuthorCreateInput): Promise<Author>;
  findAll(options: FindAllOptions): Promise<FindAllResult>;
  findById(id: number): Promise<Author | null>;
  findBySlug(slug: string): Promise<Author | null>;
  update(id: number, data: Prisma.AuthorUpdateInput): Promise<Author>;
  delete(id: number): Promise<Author>;
}
