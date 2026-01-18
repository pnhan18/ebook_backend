import { Chapter } from '@prisma/client';

export type ChapterWithBook = Chapter & {
  book: {
    id: number;
    freeChapters: number;
    requireLogin: boolean;
    coverImage: string | null;
    accessType: string;
  };
  audio?: {
    status: string;
    audioKey: string | null;
  } | null;
};

export interface IChaptersRepository {
  findByBookSlug(bookSlug: string): Promise<Chapter[]>;
  findById(id: number): Promise<Chapter | null>;
  findBySlug(bookSlug: string, chapterSlug: string): Promise<ChapterWithBook | null>;
}
