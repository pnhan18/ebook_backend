import { Favorite } from '@prisma/client';

export interface BookSummary {
  id: number;
  title: string;
  slug: string;
  coverImage: string | null;
  description: string | null;
}

export interface FavoriteWithBook extends Favorite {
  book: BookSummary;
}

export interface FindAllResult {
  data: FavoriteWithBook[];
  total: number;
}

export interface IFavoritesRepository {
  create(userId: number, bookId: number): Promise<Favorite>;
  findAllByUser(userId: number, options: { page: number; limit: number }): Promise<FindAllResult>;
  findOne(userId: number, bookId: number): Promise<Favorite | null>;
  delete(userId: number, bookId: number): Promise<Favorite>;
  countByBook(bookId: number): Promise<number>;
}
