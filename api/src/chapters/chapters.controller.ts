import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
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
  constructor(
    private readonly chaptersService: ChaptersService,
  ) { }

  @Get()
  @UseGuards(JwtOptionalGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all chapters of a book' })
  @ApiParam({ name: 'bookSlug', type: String, description: 'Book slug' })
  @ApiSuccessArrayResponse(ChapterResponseDto)
  @ApiNotFoundResponse('Book not found')
  findAll(
    @Param('bookSlug') bookSlug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.chaptersService.findByBookSlug(bookSlug, user?.id);
  }

  @Get(':chapterSlug')
  @UseGuards(JwtOptionalGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get chapter detail with content URL (records book view)' })
  @ApiParam({ name: 'bookSlug', type: String, description: 'Book slug' })
  @ApiParam({ name: 'chapterSlug', type: String, description: 'Chapter slug' })
  @ApiSuccessResponse(ChapterDetailResponseDto)
  @ApiNotFoundResponse('Chapter not found')
  async findBySlug(
    @Param('bookSlug') bookSlug: string,
    @Param('chapterSlug') chapterSlug: string,
    @Req() req: Request,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();
    const userAgent = req.headers['user-agent'];

    return this.chaptersService.findBySlug(
      bookSlug,
      chapterSlug,
      user?.id,
      ipAddress,
      userAgent,
    );
  }
}
