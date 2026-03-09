import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';
import { ChaptersService } from './chapters.service';
import { ChapterResponseDto, ChapterDetailResponseDto } from './dto';
import { JwtOptionalGuard } from 'src/auth/guards';
import {
  CurrentUser,
  ApiSuccessResponse,
  ApiSuccessArrayResponse,
  ApiNotFoundResponse,
} from 'src/common/decorators';
import type { AuthenticatedUser } from 'src/common';

@ApiTags('Chapters')
@Controller('books/:bookSlug/chapters')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all chapters of a book' })
  @ApiParam({ name: 'bookSlug', type: String, description: 'Book slug' })
  @ApiSuccessArrayResponse(ChapterResponseDto)
  @ApiNotFoundResponse('Book not found')
  findAll(@Param('bookSlug') bookSlug: string) {
    return this.chaptersService.findByBookSlug(bookSlug);
  }

  @Get(':chapterSlug')
  @UseGuards(JwtOptionalGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get chapter detail with content URL' })
  @ApiParam({ name: 'bookSlug', type: String, description: 'Book slug' })
  @ApiParam({ name: 'chapterSlug', type: String, description: 'Chapter slug' })
  @ApiSuccessResponse(ChapterDetailResponseDto)
  @ApiNotFoundResponse('Chapter not found')
  findBySlug(
    @Param('bookSlug') bookSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const userContext = user
      ? { id: user.id, subscriptionPlan: user.subscriptionPlan as SubscriptionPlan }
      : undefined;
    return this.chaptersService.findBySlug(bookSlug, chapterSlug, userContext);
  }
}
