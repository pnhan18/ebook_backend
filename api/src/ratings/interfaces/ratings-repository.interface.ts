import { Rating, Prisma } from '@prisma/client';

export interface BookSummary {
  id: number;
  title: string;
  slug: string;
  coverImage: string | null;
}

export interface RatingWithBook extends Rating {
  book: BookSummary;
}

export interface UserSummary {
  id: number;
  username: string;
  avatar: string | null;
}

export interface RatingWithUser extends Rating {
  user: UserSummary;
}

export interface RatingSummary {
  averageRating: number;
  ratingCount: number;
  distribution: Record<number, number>;
}

export interface IRatingsRepository {
  create(data: Prisma.RatingUncheckedCreateInput): Promise<Rating>;
  findAllByUser(userId: number, options: { page: number; limit: number }): Promise<{ data: RatingWithBook[]; total: number }>;
  findAllByBook(bookId: number, options: { page: number; limit: number }): Promise<{ data: RatingWithUser[]; total: number }>;
  findOne(userId: number, bookId: number): Promise<Rating | null>;
  update(userId: number, bookId: number, data: Prisma.RatingUpdateInput): Promise<Rating>;
  delete(userId: number, bookId: number): Promise<Rating>;
  getBookStats(bookId: number): Promise<{ averageRating: number; ratingCount: number }>;
  getSummary(bookId: number): Promise<RatingSummary>;
}
