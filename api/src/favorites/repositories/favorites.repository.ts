import { Injectable } from '@nestjs/common';
import { Favorite } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IFavoritesRepository, FavoriteWithBook } from '../interfaces/favorites-repository.interface';

@Injectable()
export class FavoritesRepository implements IFavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, bookId: number): Promise<Favorite> {
    return this.prisma.favorite.create({
      data: { userId, bookId },
    });
  }

  async findAllByUser(
    userId: number,
    options: { page: number; limit: number },
  ): Promise<{ data: FavoriteWithBook[]; total: number }> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
              description: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ]);

    return { data: data as FavoriteWithBook[], total };
  }

  async findOne(userId: number, bookId: number): Promise<Favorite | null> {
    return this.prisma.favorite.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
  }

  async delete(userId: number, bookId: number): Promise<Favorite> {
    return this.prisma.favorite.delete({
      where: { userId_bookId: { userId, bookId } },
    });
  }

  async countByBook(bookId: number): Promise<number> {
    return this.prisma.favorite.count({ where: { bookId } });
  }
}
