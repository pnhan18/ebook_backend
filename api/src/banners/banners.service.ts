import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Banner } from '@prisma/client';
import { StorageService } from 'src/storage/storage.service';
import { CreateBannerDto, UpdateBannerDto, AdminQueryBannerDto, PublicQueryBannerDto } from './dto';
import { PaginatedResponseDto, StorageUrlHelper } from '../common';
import type { IBannersRepository } from './interfaces/banners-repository.interface';
import { CacheService } from '../cache/cache.service';
import { CacheTTL } from '../cache/cache.constants';

@Injectable()
export class BannersService {
  private readonly urlHelper: StorageUrlHelper;

  constructor(
    @Inject('IBannersRepository')
    private readonly bannersRepository: IBannersRepository,
    private readonly storageService: StorageService,
    private readonly cacheService: CacheService,
  ) {
    this.urlHelper = new StorageUrlHelper(storageService);
  }

  private async transformBannerUrls<T extends { imageUrl?: string | null }>(banner: T): Promise<T> {
    return this.urlHelper.transformOne(banner, ['imageUrl']);
  }

  private async transformBannersUrls<T extends { imageUrl?: string | null }>(banners: T[]): Promise<T[]> {
    return this.urlHelper.transformMany(banners, ['imageUrl']);
  }

  async create(createBannerDto: CreateBannerDto): Promise<Banner> {
    const banner = await this.bannersRepository.create({
      ...createBannerDto,
      startDate: createBannerDto.startDate ? new Date(createBannerDto.startDate) : null,
      endDate: createBannerDto.endDate ? new Date(createBannerDto.endDate) : null,
    });
    await this.cacheService.invalidateBanners();
    return banner;
  }

  async findAllPublic(query: PublicQueryBannerDto): Promise<PaginatedResponseDto<Banner>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const cacheKey = this.cacheService.bannersKey() + `:${page}:${limit}:${query.position || 'all'}`;

    return this.cacheService.wrap(
      cacheKey,
      async () => {
        const { data, total } = await this.bannersRepository.findAllPublic({
          page,
          limit,
          position: query.position,
        });
        const transformedData = await this.transformBannersUrls(data);
        return new PaginatedResponseDto(transformedData, total, page, limit);
      },
      { ttl: CacheTTL.BANNERS_ACTIVE },
    );
  }

  async findAllAdmin(query: AdminQueryBannerDto): Promise<PaginatedResponseDto<Banner>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.bannersRepository.findAll({
      page,
      limit,
      position: query.position,
      isActive: query.isActive,
    });
    const transformedData = await this.transformBannersUrls(data);
    return new PaginatedResponseDto(transformedData, total, page, limit);
  }

  async findOne(id: number): Promise<Banner> {
    const banner = await this.bannersRepository.findById(id);
    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }
    return this.transformBannerUrls(banner);
  }

  async update(id: number, updateBannerDto: UpdateBannerDto): Promise<Banner> {
    await this.findOne(id);
    const banner = await this.bannersRepository.update(id, {
      ...updateBannerDto,
      startDate: updateBannerDto.startDate ? new Date(updateBannerDto.startDate) : undefined,
      endDate: updateBannerDto.endDate ? new Date(updateBannerDto.endDate) : undefined,
    });
    await this.cacheService.invalidateBanners();
    return banner;
  }

  async remove(id: number): Promise<Banner> {
    await this.findOne(id);
    const banner = await this.bannersRepository.delete(id);
    await this.cacheService.invalidateBanners();
    return banner;
  }
}
