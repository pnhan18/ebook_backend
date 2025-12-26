import { Controller, Get, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RatingResponseDto } from './dto';

@ApiTags('Ratings')
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my rating for a book',
    description:
      'Check if the current user has rated a specific book. Returns the rating object if exists, or null if not rated yet. Useful for UI to show "Write review" or "Edit review" button.',
  })
  @ApiQuery({
    name: 'bookId',
    type: Number,
    required: true,
    description: 'The ID of the book to check rating for',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns user rating or null if not rated',
    schema: {
      type: 'object',
      properties: {
        data: {
          oneOf: [
            { $ref: '#/components/schemas/RatingResponseDto' },
            { type: 'null' },
          ],
        },
      },
      example: {
        data: {
          id: 1,
          userId: 1,
          bookId: 1,
          score: 5,
          review: 'Great book!',
          createdAt: '2025-12-25T10:00:00.000Z',
          updatedAt: '2025-12-25T10:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - JWT token required',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async getMyRating(
    @CurrentUser('id') userId: number,
    @Query('bookId', ParseIntPipe) bookId: number,
  ) {
    const rating = await this.ratingsService.getMyRating(userId, bookId);
    return { data: rating };
  }
}
