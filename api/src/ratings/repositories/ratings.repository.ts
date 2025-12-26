import { Injectable } from '@nestjs/common';
import { Rating, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IRatingsRepository,
  RatingWithBook,
  RatingWithUser,
} from '../interfaces/ratings-repository.interface';

@Injectable()
export class RatingsRepository implements IRatingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.RatingUncheckedCreateInput): Promise<Rating> {
    return this.prisma.rating.create({ data });
  }

  async findAllByUser(
    userId: number,
    options: { page: number; limit: number },
  ): Promise<{ data: RatingWithBook[]; total: number }> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.rating.findMany({
        where: { userId },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rating.count({ where: { userId } }),
    ]);

    return { data: data as RatingWithBook[], total };
  }

  async findAllByBook(
    bookId: number,
    options: { page: number; limit: number },
  ): Promise<{ data: RatingWithUser[]; total: number }> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.rating.findMany({
        where: { bookId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rating.count({ where: { bookId } }),
    ]);

    return { data: data as RatingWithUser[], total };
  }

  async findOne(userId: number, bookId: number): Promise<Rating | null> {
    return this.prisma.rating.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
  }

  async update(userId: number, bookId: number, data: Prisma.RatingUpdateInput): Promise<Rating> {
    return this.prisma.rating.update({
      where: { userId_bookId: { userId, bookId } },
      data,
    });
  }

  async delete(userId: number, bookId: number): Promise<Rating> {
    return this.prisma.rating.delete({
      where: { userId_bookId: { userId, bookId } },
    });
  }

  async getBookStats(bookId: number): Promise<{ averageRating: number; ratingCount: number }> {
    const result = await this.prisma.rating.aggregate({
      where: { bookId },
      _avg: { score: true },
      _count: { score: true },
    });

    return {
      averageRating: result._avg.score ?? 0,
      ratingCount: result._count.score,
    };
  }

  async getSummary(bookId: number): Promise<{
    averageRating: number;
    ratingCount: number;
    distribution: Record<number, number>;
  }> {
    const [stats, grouped] = await Promise.all([
      this.getBookStats(bookId),
      this.prisma.rating.groupBy({
        by: ['score'],
        where: { bookId },
        _count: { score: true },
      }),
    ]);

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    grouped.forEach((g) => {
      distribution[g.score] = g._count.score;
    });

    return {
      ...stats,
      distribution,
    };
  }
}
