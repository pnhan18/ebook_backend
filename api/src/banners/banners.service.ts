import { Injectable, NotFoundException } from '@nestjs/common';
import { Banner } from '@prisma/client';
import { BannersRepository } from './repositories/banners.repository';
import { CreateBannerDto, UpdateBannerDto, AdminQueryBannerDto, PublicQueryBannerDto } from './dto';
import { PaginatedResponseDto } from '../common';

@Injectable()
export class BannersService {
  constructor(private readonly bannersRepository: BannersRepository) {}

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
    return new PaginatedResponseDto(data, total, page, limit);
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
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: number): Promise<Banner> {
    const banner = await this.bannersRepository.findById(id);
    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }
    return banner;
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
