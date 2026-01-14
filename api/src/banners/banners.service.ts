import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Banner } from '@prisma/client';
import { StorageService } from 'src/storage/storage.service';
import { CreateBannerDto, UpdateBannerDto, AdminQueryBannerDto, PublicQueryBannerDto } from './dto';
import { PaginatedResponseDto, StorageUrlHelper } from '../common';
import type { IBannersRepository } from './interfaces/banners-repository.interface';

@Injectable()
export class BannersService {
  private readonly urlHelper: StorageUrlHelper;

  constructor(
    @Inject('IBannersRepository')
    private readonly bannersRepository: IBannersRepository,
    private readonly storageService: StorageService,
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
    return this.bannersRepository.create({
      ...createBannerDto,
      startDate: createBannerDto.startDate ? new Date(createBannerDto.startDate) : null,
      endDate: createBannerDto.endDate ? new Date(createBannerDto.endDate) : null,
    });
  }

  async findAllPublic(query: PublicQueryBannerDto): Promise<PaginatedResponseDto<Banner>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.bannersRepository.findAllPublic({
      page,
      limit,
      position: query.position,
    });
    const transformedData = await this.transformBannersUrls(data);
    return new PaginatedResponseDto(transformedData, total, page, limit);
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
    return this.bannersRepository.update(id, {
      ...updateBannerDto,
      startDate: updateBannerDto.startDate ? new Date(updateBannerDto.startDate) : undefined,
      endDate: updateBannerDto.endDate ? new Date(updateBannerDto.endDate) : undefined,
    });
  }

  async remove(id: number): Promise<Banner> {
    await this.findOne(id);
    return this.bannersRepository.delete(id);
  }
}
