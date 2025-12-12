import { Chapter } from '@prisma/client';

export type ChapterWithBook = Chapter & {
  book: {
    freeChapters: number;
    requireLogin: boolean;
    coverImage: string | null;
  };
};

export interface IChaptersRepository {
  findByBookId(bookId: number): Promise<Chapter[]>;
  findById(id: number): Promise<Chapter | null>;
  findBySlug(bookId: number, slug: string): Promise<ChapterWithBook | null>;
}
