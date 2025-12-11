import { Module } from '@nestjs/common';
import { BannersController, AdminBannersController } from './banners.controller';
import { BannersService } from './banners.service';
import { BannersRepository } from './repositories/banners.repository';

@Module({
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService, BannersRepository],
  exports: [BannersService],
})
export class BannersModule {}
