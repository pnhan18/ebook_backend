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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto';
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

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiSuccessResponse(CategoryResponseDto, 201, 'Category created')
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse('Category already exists')
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories with pagination' })
  @ApiPaginatedResponse(CategoryResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.categoriesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiSuccessResponse(CategoryResponseDto)
  @ApiNotFoundResponse('Category not found')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiSuccessResponse(CategoryResponseDto)
  @ApiNotFoundResponse('Category not found')
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update category' })
  @ApiSuccessResponse(CategoryResponseDto)
  @ApiBadRequestResponse('Validation failed')
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Category not found')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete category' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse('Category not found')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}
