import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Rating } from '@prisma/client';
import { PaginationQueryDto, PaginatedResponseDto } from '../common';
import { CreateRatingDto, UpdateRatingDto } from './dto';
import type { IRatingsRepository } from './interfaces/ratings-repository.interface';
import { RatingWithUser } from './interfaces/ratings-repository.interface';
import { RatingChangedEvent } from './events/rating.events';

@Injectable()
export class RatingsService {
  constructor(
    @Inject('IRatingsRepository')
    private readonly ratingsRepository: IRatingsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: number, bookId: number, dto: CreateRatingDto): Promise<Rating> {
    const existing = await this.ratingsRepository.findOne(userId, bookId);
    if (existing) {
      throw new ConflictException('You have already rated this book');
    }

    const rating = await this.ratingsRepository.create({
      userId,
      bookId,
      score: dto.score,
      review: dto.review,
    });

    await this.emitRatingChanged(bookId);
    return rating;
  }

  async update(userId: number, bookId: number, dto: UpdateRatingDto): Promise<Rating> {
    const existing = await this.ratingsRepository.findOne(userId, bookId);
    if (!existing) {
      throw new NotFoundException('Rating not found');
    }

    const rating = await this.ratingsRepository.update(userId, bookId, dto);
    await this.emitRatingChanged(bookId);
    return rating;
  }

  async remove(userId: number, bookId: number): Promise<Rating> {
    const existing = await this.ratingsRepository.findOne(userId, bookId);
    if (!existing) {
      throw new NotFoundException('Rating not found');
    }

    const rating = await this.ratingsRepository.delete(userId, bookId);
    await this.emitRatingChanged(bookId);
    return rating;
  }

  async findAllByBook(
    bookId: number,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<RatingWithUser>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.ratingsRepository.findAllByBook(bookId, { page, limit });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getStats(userId: number | null, bookId: number) {
    const [stats, userRating] = await Promise.all([
      this.ratingsRepository.getBookStats(bookId),
      userId ? this.ratingsRepository.findOne(userId, bookId) : null,
    ]);

    return {
      ...stats,
      userRating,
    };
  }

  async getSummary(bookId: number) {
    return this.ratingsRepository.getSummary(bookId);
  }

  async getBookStats(bookId: number) {
    return this.ratingsRepository.getBookStats(bookId);
  }

  async getMyRating(userId: number, bookId: number): Promise<Rating | null> {
    return this.ratingsRepository.findOne(userId, bookId);
  }

  private async emitRatingChanged(bookId: number): Promise<void> {
    const stats = await this.ratingsRepository.getBookStats(bookId);
    this.eventEmitter.emit(
      'rating.changed',
      new RatingChangedEvent(bookId, stats.averageRating, stats.ratingCount),
    );
  }
}
