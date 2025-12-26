import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { BooksService } from './books.service';
import { CreateBookDto, UpdateBookDto, AdminQueryBookDto, PublicQueryBookDto, BookResponseDto, BookMinimalResponseDto } from './dto';
import { JwtAuthGuard, RolesGuard, JwtOptionalGuard } from 'src/auth/guards';
import {
  Roles,
  CurrentUser,
  ApiSuccessResponse,
  ApiSuccessArrayResponse,
  ApiPaginatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from 'src/common/decorators';
import type { AuthenticatedUser, PaginationQueryDto } from 'src/common';
import { BooksSearchService } from './search/books-search.service';
import { FavoritesService } from '../favorites/favorites.service';
import { FavoriteResponseDto, FavoriteStatusResponseDto } from '../favorites/dto';
import { RatingsService } from '../ratings/ratings.service';
import {
  CreateRatingDto,
  UpdateRatingDto,
  RatingResponseDto,
  RatingWithUserResponseDto,
  RatingStatsResponseDto,
  RatingSummaryResponseDto,
} from '../ratings/dto';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly booksSearchService: BooksSearchService,
    private readonly favoritesService: FavoritesService,
    private readonly ratingsService: RatingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all published books' })
  @ApiPaginatedResponse(BookResponseDto)
  findAllPublic(@Query() query: PublicQueryBookDto) {
    return this.booksService.findAllPublic(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search books' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  search(
    @Query('q') query: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.booksSearchService.search(query, { page, limit });
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get most popular books (all time)' })
  @ApiSuccessArrayResponse(BookMinimalResponseDto)
  findPopular(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.booksService.findPopular(limit || 10);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending books (week or month)' })
  @ApiSuccessArrayResponse(BookMinimalResponseDto)
  findTrending(
    @Query('period') period?: 'week' | 'month',
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.booksService.findTrending(period || 'week', limit || 10);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest books' })
  @ApiSuccessArrayResponse(BookMinimalResponseDto)
  findLatest(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.booksService.findLatest(limit || 10);
  }

  @Post(':bookId/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add book to favorites' })
  @ApiSuccessResponse(FavoriteResponseDto, 201, 'Book added to favorites')
  @ApiUnauthorizedResponse()
  @ApiConflictResponse('Book already in favorites')
  addFavorite(
    @CurrentUser('id') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.favoritesService.add(userId, bookId);
  }

  @Delete(':bookId/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove book from favorites' })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse('Favorite not found')
  removeFavorite(
    @CurrentUser('id') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.favoritesService.remove(userId, bookId);
  }

  @Get(':bookId/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Check if book is favorited and get total favorites count' })
  @ApiSuccessResponse(FavoriteStatusResponseDto)
  @ApiUnauthorizedResponse()
  getFavoriteStatus(
    @CurrentUser('id') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.favoritesService.getStatus(userId, bookId);
  }

  @Post(':bookId/rating')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Rate a book' })
  @ApiSuccessResponse(RatingResponseDto, 201, 'Rating created')
  @ApiUnauthorizedResponse()
  @ApiConflictResponse('You have already rated this book')
  createRating(
    @CurrentUser('id') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingsService.create(userId, bookId, dto);
  }

  @Patch(':bookId/rating')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update your rating' })
  @ApiSuccessResponse(RatingResponseDto)
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse('Rating not found')
  updateRating(
    @CurrentUser('id') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
    @Body() dto: UpdateRatingDto,
  ) {
    return this.ratingsService.update(userId, bookId, dto);
  }

  @Delete(':bookId/rating')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete your rating' })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse('Rating not found')
  deleteRating(
    @CurrentUser('id') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.ratingsService.remove(userId, bookId);
  }

  @Get(':bookId/rating')
  @UseGuards(JwtOptionalGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get book rating stats and current user rating' })
  @ApiSuccessResponse(RatingStatsResponseDto)
  getRatingStats(
    @CurrentUser('id') userId: number | undefined,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.ratingsService.getStats(userId ?? null, bookId);
  }

  @Get(':bookId/rating/summary')
  @ApiOperation({ summary: 'Get book rating summary with distribution' })
  @ApiSuccessResponse(RatingSummaryResponseDto)
  getRatingSummary(@Param('bookId', ParseIntPipe) bookId: number) {
    return this.ratingsService.getSummary(bookId);
  }

  @Get(':bookId/ratings')
  @ApiOperation({ summary: 'Get all ratings of a book' })
  @ApiPaginatedResponse(RatingWithUserResponseDto)
  getBookRatings(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.ratingsService.findAllByBook(bookId, query);
  }

  @Get(':slug')
  @UseGuards(JwtOptionalGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get book by slug (records view)' })
  @ApiSuccessResponse(BookResponseDto)
  @ApiNotFoundResponse('Book not found')
  findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();
    const userAgent = req.headers['user-agent'];

    return this.booksService.findBySlug(slug, {
      userId: user?.id,
      ipAddress,
      userAgent,
    });
  }
}

@ApiTags('Admin Books')
@Controller('admin/books')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('JWT-auth')
export class AdminBooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new book' })
  @ApiSuccessResponse(BookResponseDto, 201, 'Book created')
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse('Book already exists')
  create(@Body() createBookDto: CreateBookDto) {
    return this.booksService.create(createBookDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all books (admin)' })
  @ApiPaginatedResponse(BookResponseDto)
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  findAll(@Query() query: AdminQueryBookDto) {
    return this.booksService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get book by ID (admin)' })
  @ApiSuccessResponse(BookResponseDto)
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Book not found')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update book' })
  @ApiSuccessResponse(BookResponseDto)
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Book not found')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBookDto: UpdateBookDto,
  ) {
    return this.booksService.update(id, updateBookDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete book' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Book not found')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.remove(id);
  }
}
