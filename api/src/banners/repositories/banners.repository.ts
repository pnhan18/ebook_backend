import { Injectable } from '@nestjs/common';
import { Banner, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  IBannersRepository,
  FindAllOptions,
  FindAllPublicOptions,
  FindAllResult,
} from '../interfaces';

@Injectable()
export class BannersRepository implements IBannersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.BannerCreateInput): Promise<Banner> {
    return this.prisma.banner.create({ data });
  }

  async findById(id: number): Promise<Banner | null> {
    return this.prisma.banner.findUnique({ where: { id } });
  }

  async findAll(options: FindAllOptions): Promise<FindAllResult> {
    const { page, limit, position, isActive } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.BannerWhereInput = {};
    if (position) where.position = position;
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await Promise.all([
      this.prisma.banner.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.banner.count({ where }),
    ]);

    return { data, total };
  }

  async findAllPublic(options: FindAllPublicOptions): Promise<FindAllResult> {
    const { page, limit, position } = options;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.BannerWhereInput = {
      isActive: true,
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: { gte: now } },
      ],
    };
    if (position) where.position = position;

    const [data, total] = await Promise.all([
      this.prisma.banner.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.banner.count({ where }),
    ]);

    return { data, total };
  }

  async update(id: number, data: Prisma.BannerUpdateInput): Promise<Banner> {
    return this.prisma.banner.update({ where: { id }, data });
  }

  async delete(id: number): Promise<Banner> {
    return this.prisma.banner.delete({ where: { id } });
  }
}
