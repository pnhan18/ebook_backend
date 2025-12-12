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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { CreateBookDto, UpdateBookDto, AdminQueryBookDto, PublicQueryBookDto, BookResponseDto } from './dto';
import { JwtAuthGuard, RolesGuard } from 'src/auth/guards';
import {
  Roles,
  ApiSuccessResponse,
  ApiPaginatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from 'src/common/decorators';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all published books' })
  @ApiPaginatedResponse(BookResponseDto)
  findAllPublic(@Query() query: PublicQueryBookDto) {
    return this.booksService.findAllPublic(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get book by ID' })
  @ApiSuccessResponse(BookResponseDto)
  @ApiNotFoundResponse('Book not found')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get book by slug' })
  @ApiSuccessResponse(BookResponseDto)
  @ApiNotFoundResponse('Book not found')
  findBySlug(@Param('slug') slug: string) {
    return this.booksService.findBySlug(slug);
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
