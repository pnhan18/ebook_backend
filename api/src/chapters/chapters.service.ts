import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubscriptionPlan } from '@prisma/client';
import type { IChaptersRepository } from './interfaces/chapters-repository.interface';
import { ChapterWithBook } from './interfaces/chapters-repository.interface';
import { StorageService } from 'src/storage/storage.service';
import { StorageUrlHelper } from 'src/common';
import { UsersService } from '../users/users.service';
import { PaymentsService } from '../payments/payments.service';
import { ChapterReadEvent } from './events/chapter-read.event';

interface UserContext {
  id: number;
  subscriptionPlan: SubscriptionPlan;
}

@Injectable()
export class ChaptersService {
  private readonly urlHelper: StorageUrlHelper;

  constructor(
    @Inject('IChaptersRepository')
    private readonly chaptersRepository: IChaptersRepository,
    private readonly storageService: StorageService,
    private readonly usersService: UsersService,
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.urlHelper = new StorageUrlHelper(storageService);
  }

  async findByBookSlug(bookSlug: string, userId?: number) {
    const chapters = await this.chaptersRepository.findByBookSlug(bookSlug);

    if (chapters.length === 0) return [];

    // Get user context if needed
    let userContext: UserContext | undefined;
    if (userId) {
      const user = await this.usersService.findById(userId);
      if (user) {
        userContext = {
          id: user.id,
          subscriptionPlan: user.subscriptionPlan as SubscriptionPlan,
        };
      }
    }

    // Get first chapter's book info for access check
    const bookInfo = (chapters[0] as any).book;
    const accessType = bookInfo?.accessType;
    const freeChapters = bookInfo?.freeChapters ?? 0;

    // Check if user has full access to the book
    let hasFullAccess = false;
    if (accessType === 'FREE') {
      hasFullAccess = true;
    } else if (accessType === 'MEMBERSHIP' && userContext?.subscriptionPlan === SubscriptionPlan.PREMIUM) {
      hasFullAccess = true;
    } else if (accessType === 'PURCHASE' && userContext) {
      // Need to check if user purchased - get bookId from first chapter
      const firstChapter = chapters[0] as any;
      hasFullAccess = await this.paymentsService.hasUserPurchasedBook(userContext.id, firstChapter.bookId);
    }

    return chapters.map((chapter: any) => {
      const { book, audio, ...chapterData } = chapter;
      const isFreeChapter = chapter.order <= freeChapters;
      const hasAudio = audio?.status === 'COMPLETED' || !!audio?.audioKey;

      return {
        ...chapterData,
        hasAccess: hasFullAccess || isFreeChapter,
        hasAudio,
      };
    });
  }

  async findOne(id: number) {
    const chapter = await this.chaptersRepository.findById(id);
    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${id} not found`);
    }
    return chapter;
  }

  async findBySlug(
    bookSlug: string,
    chapterSlug: string,
    userId?: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const chapter = await this.chaptersRepository.findBySlug(bookSlug, chapterSlug);
    if (!chapter) {
      throw new NotFoundException(`Chapter with slug "${chapterSlug}" not found`);
    }

    // Get user context if userId provided
    let userContext: UserContext | undefined;
    if (userId) {
      const user = await this.usersService.findById(userId);
      if (user) {
        userContext = {
          id: user.id,
          subscriptionPlan: user.subscriptionPlan as SubscriptionPlan,
        };
      }
    }

    const hasAccess = await this.checkChapterAccess(chapter, userContext);

    // Generate presigned URL if user has access
    let contentUrl: string | null = null;
    if (hasAccess) {
      if (chapter.contentKey) {
        contentUrl = await this.storageService.getPresignedDownloadUrl(chapter.contentKey);
      }

      // Emit event to record view
      this.eventEmitter.emit(
        'chapter.read',
        new ChapterReadEvent(chapter.book.id, userId, ipAddress, userAgent),
      );
    }

    // Remove book, contentKey and audio from response
    const { book, contentKey, audio, ...chapterData } = chapter;
    const hasAudio = audio?.status === 'COMPLETED' || !!audio?.audioKey;

    return {
      ...chapterData,
      contentUrl,
      hasAccess,
      hasAudio,
    };
  }

  private async checkChapterAccess(
    chapter: ChapterWithBook,
    user?: UserContext,
  ): Promise<boolean> {
    const { book } = chapter;

    const isFreeChapter = chapter.order <= book.freeChapters;
    if (isFreeChapter) {
      return true;
    }

    switch (book.accessType) {
      case 'FREE':
        return true;
      case 'MEMBERSHIP':
        return user?.subscriptionPlan === SubscriptionPlan.PREMIUM;
      case 'PURCHASE':
        if (!user) return false;
        return this.paymentsService.hasUserPurchasedBook(user.id, chapter.bookId);
      default:
        return false;
    }
  }
}
