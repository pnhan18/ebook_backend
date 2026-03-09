import { Banner, BannerPosition, Prisma } from '@prisma/client';

export interface FindAllOptions {
  page: number;
  limit: number;
  position?: BannerPosition;
  isActive?: boolean;
}

export interface FindAllPublicOptions {
  page: number;
  limit: number;
  position?: BannerPosition;
}

export interface FindAllResult {
  data: Banner[];
  total: number;
}

export interface IBannersRepository {
  create(data: Prisma.BannerCreateInput): Promise<Banner>;
  findById(id: number): Promise<Banner | null>;
  findAll(options: FindAllOptions): Promise<FindAllResult>;
  findAllPublic(options: FindAllPublicOptions): Promise<FindAllResult>;
  update(id: number, data: Prisma.BannerUpdateInput): Promise<Banner>;
  delete(id: number): Promise<Banner>;
}
