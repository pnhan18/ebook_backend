import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
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
@Controller('books/:bookId/chapters')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all chapters of a book' })
  @ApiParam({ name: 'bookId', type: Number, description: 'Book ID' })
  @ApiSuccessArrayResponse(ChapterResponseDto)
  @ApiNotFoundResponse('Book not found')
  findAll(@Param('bookId', ParseIntPipe) bookId: number) {
    return this.chaptersService.findByBookId(bookId);
  }

  @Get(':slug')
  @UseGuards(JwtOptionalGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get chapter content by slug' })
  @ApiParam({ name: 'bookId', type: Number, description: 'Book ID' })
  @ApiParam({ name: 'slug', type: String, description: 'Chapter slug' })
  @ApiSuccessResponse(ChapterDetailResponseDto)
  @ApiNotFoundResponse('Chapter not found')
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
