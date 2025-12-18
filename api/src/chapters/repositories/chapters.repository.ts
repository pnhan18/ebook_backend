import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Chapter } from '@prisma/client';
import { IChaptersRepository } from '../interfaces/chapters-repository.interface';

@Injectable()
export class ChaptersRepository implements IChaptersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByBookSlug(bookSlug: string): Promise<Chapter[]> {
    return this.prisma.chapter.findMany({
      where: { book: { slug: bookSlug } },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        order: true,
      },
    }) as unknown as Chapter[];
  }

  async findById(id: number): Promise<Chapter | null> {
    return this.prisma.chapter.findUnique({
      where: { id },
    });
  }

  async findBySlug(bookSlug: string, chapterSlug: string): Promise<import('../interfaces/chapters-repository.interface').ChapterWithBook | null> {
    return this.prisma.chapter.findFirst({
      where: {
        slug: chapterSlug,
        book: { slug: bookSlug },
      },
      include: {
        book: {
          select: {
            freeChapters: true,
            requireLogin: true,
            coverImage: true,
          },
        },
      },
    });
  }
}
