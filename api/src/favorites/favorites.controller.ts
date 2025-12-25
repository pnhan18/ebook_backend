import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { FavoriteResponseDto } from './dto';
import { PaginationQueryDto } from '../common';
import { JwtAuthGuard } from 'src/auth/guards';
import { CurrentUser, ApiPaginatedResponse, ApiUnauthorizedResponse } from 'src/common/decorators';

@ApiTags('Favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all favorites of current user with book details' })
  @ApiPaginatedResponse(FavoriteResponseDto)
  @ApiUnauthorizedResponse()
  findAll(@CurrentUser('id') userId: number, @Query() query: PaginationQueryDto) {
    return this.favoritesService.findAllByUser(userId, query);
  }
}
