import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Favorite } from '@prisma/client';
import { FavoritesRepository } from './repositories/favorites.repository';
import { PaginationQueryDto, PaginatedResponseDto } from '../common';
import { FavoriteWithBook } from './interfaces/favorites-repository.interface';

@Injectable()
export class FavoritesService {
  constructor(private readonly favoritesRepository: FavoritesRepository) {}

  async add(userId: number, bookId: number): Promise<Favorite> {
    const existing = await this.favoritesRepository.findOne(userId, bookId);
    if (existing) {
      throw new ConflictException('Book already in favorites');
    }
    return this.favoritesRepository.create(userId, bookId);
  }

  async remove(userId: number, bookId: number): Promise<Favorite> {
    const existing = await this.favoritesRepository.findOne(userId, bookId);
    if (!existing) {
      throw new NotFoundException('Favorite not found');
    }
    return this.favoritesRepository.delete(userId, bookId);
  }

  async findAllByUser(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<FavoriteWithBook>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.favoritesRepository.findAllByUser(userId, { page, limit });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getStatus(userId: number, bookId: number) {
    const [favorite, totalFavorites] = await Promise.all([
      this.favoritesRepository.findOne(userId, bookId),
      this.favoritesRepository.countByBook(bookId),
    ]);
    return {
      isFavorited: !!favorite,
      totalFavorites,
    };
  }

  async countByBook(bookId: number): Promise<number> {
    return this.favoritesRepository.countByBook(bookId);
  }
}
