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
import { AuthorsService } from './authors.service';
import { CreateAuthorDto, UpdateAuthorDto, AuthorResponseDto } from './dto';
import { PaginationQueryDto } from '../common';
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

@ApiTags('Authors')
@Controller('authors')
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new author' })
  @ApiSuccessResponse(AuthorResponseDto, 201, 'Author created')
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse('Author already exists')
  create(@Body() createAuthorDto: CreateAuthorDto) {
    return this.authorsService.create(createAuthorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all authors with pagination' })
  @ApiPaginatedResponse(AuthorResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.authorsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get author by ID' })
  @ApiSuccessResponse(AuthorResponseDto)
  @ApiNotFoundResponse('Author not found')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.authorsService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get author by slug' })
  @ApiSuccessResponse(AuthorResponseDto)
  @ApiNotFoundResponse('Author not found')
  findBySlug(@Param('slug') slug: string) {
    return this.authorsService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update author' })
  @ApiSuccessResponse(AuthorResponseDto)
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Author not found')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAuthorDto: UpdateAuthorDto,
  ) {
    return this.authorsService.update(id, updateAuthorDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete author' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Author not found')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.authorsService.remove(id);
  }
}
