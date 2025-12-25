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
import type { AuthenticatedUser } from 'src/common';
import { BooksSearchService } from './search/books-search.service';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly booksSearchService: BooksSearchService,
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
