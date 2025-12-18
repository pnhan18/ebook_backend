import { Chapter } from '@prisma/client';

export type ChapterWithBook = Chapter & {
  book: {
    freeChapters: number;
    requireLogin: boolean;
    coverImage: string | null;
  };
};

export interface IChaptersRepository {
  findByBookSlug(bookSlug: string): Promise<Chapter[]>;
  findById(id: number): Promise<Chapter | null>;
  findBySlug(bookSlug: string, chapterSlug: string): Promise<ChapterWithBook | null>;
}
