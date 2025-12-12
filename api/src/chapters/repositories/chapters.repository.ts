import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Chapter } from '@prisma/client';
import { IChaptersRepository } from '../interfaces/chapters-repository.interface';

@Injectable()
export class ChaptersRepository implements IChaptersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByBookId(bookId: number): Promise<Chapter[]> {
    return this.prisma.chapter.findMany({
      where: { bookId },
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

  async findBySlug(bookId: number, slug: string): Promise<import('../interfaces/chapters-repository.interface').ChapterWithBook | null> {
    return this.prisma.chapter.findUnique({
      where: { bookId_slug: { bookId, slug } },
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
