import { Injectable } from '@nestjs/common';
import { Author, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IAuthorsRepository, FindAllOptions, FindAllResult } from '../interfaces/authors-repository.interface';

@Injectable()
export class AuthorsRepository implements IAuthorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.AuthorCreateInput): Promise<Author> {
    return this.prisma.author.create({ data });
  }

  async findAll(options: FindAllOptions): Promise<FindAllResult> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.author.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.author.count(),
    ]);

    return { data, total };
  }

  async findById(id: number): Promise<Author | null> {
    return this.prisma.author.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Author | null> {
    return this.prisma.author.findUnique({ where: { slug } });
  }

  async update(id: number, data: Prisma.AuthorUpdateInput): Promise<Author> {
    return this.prisma.author.update({ where: { id }, data });
  }

  async delete(id: number): Promise<Author> {
    return this.prisma.author.delete({ where: { id } });
  }
}
