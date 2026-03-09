import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { JwtOptionalGuard } from '../auth/guards/jwt-optional.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get()
  @UseGuards(JwtOptionalGuard)
  @ApiOperation({ summary: 'Get personalized book recommendations' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecommendations(
    @CurrentUser() user: { id: number } | null,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return this.recommendationsService.getRecommendations(user?.id, limit);
  }

  @Get('similar/:bookId')
  @ApiOperation({ summary: 'Get similar books' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSimilarBooks(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return this.recommendationsService.getSimilarBooks(bookId, limit);
  }
}
