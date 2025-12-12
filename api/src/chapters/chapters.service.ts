import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { ChaptersRepository } from './repositories/chapters.repository';
import { ChapterWithBook } from './interfaces/chapters-repository.interface';
import { StorageService } from 'src/storage/storage.service';
import { StorageUrlHelper } from 'src/common';

interface UserContext {
  id: number;
  subscriptionPlan: SubscriptionPlan;
}

@Injectable()
export class ChaptersService {
  private readonly urlHelper: StorageUrlHelper;

  constructor(
    private readonly chaptersRepository: ChaptersRepository,
    private readonly storageService: StorageService,
  ) {
    this.urlHelper = new StorageUrlHelper(storageService);
  }

  async findByBookId(bookId: number) {
    return this.chaptersRepository.findByBookId(bookId);
  }

  async findOne(id: number) {
    const chapter = await this.chaptersRepository.findById(id);
    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${id} not found`);
    }
    return chapter;
  }

  async findBySlug(bookId: number, slug: string, user?: UserContext) {
    const chapter = await this.chaptersRepository.findBySlug(bookId, slug);
    if (!chapter) {
      throw new NotFoundException(`Chapter with slug "${slug}" not found`);
    }

    const hasAccess = this.checkChapterAccess(chapter, user);

    // Generate presigned URL if user has access
    let contentUrl: string | null = null;
    if (hasAccess && chapter.contentKey) {
      contentUrl = await this.storageService.getPresignedDownloadUrl(chapter.contentKey);
    }

    // Remove book and contentKey from response
    const { book, contentKey, ...chapterData } = chapter;

    return {
      ...chapterData,
      contentUrl,
      hasAccess,
    };
  }

  private checkChapterAccess(
    chapter: ChapterWithBook,
    user?: UserContext,
  ): boolean {
    const { book } = chapter;

    // Chapter nằm trong số chapter miễn phí
    const isFreeChapter = chapter.order <= book.freeChapters;

    // Nếu là free chapter và không yêu cầu login -> cho xem
    if (isFreeChapter && !book.requireLogin) {
      return true;
    }

    // Nếu là free chapter nhưng yêu cầu login -> cần đăng nhập
    if (isFreeChapter && book.requireLogin) {
      return !!user;
    }

    // Chapter trả phí -> cần user PREMIUM
    if (!user) {
      return false;
    }

    return user.subscriptionPlan === SubscriptionPlan.PREMIUM;
  }
}
