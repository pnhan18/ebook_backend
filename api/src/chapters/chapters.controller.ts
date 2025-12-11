import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { ChaptersService } from './chapters.service';
import { JwtOptionalGuard } from 'src/auth/guards';
import { CurrentUser } from 'src/common/decorators';
import type { AuthenticatedUser } from 'src/common';

@Controller('books/:bookId/chapters')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Get()
  findAll(@Param('bookId', ParseIntPipe) bookId: number) {
    return this.chaptersService.findByBookId(bookId);
  }

  @UseGuards(JwtOptionalGuard)
  @Get(':slug')
  findBySlug(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const userContext = user
      ? { id: user.id, subscriptionPlan: user.subscriptionPlan as SubscriptionPlan }
      : undefined;
    return this.chaptersService.findBySlug(bookId, slug, userContext);
  }
}
