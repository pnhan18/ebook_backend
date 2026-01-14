import { Module } from '@nestjs/common';
import { BannersController, AdminBannersController } from './banners.controller';
import { BannersService } from './banners.service';
import { BannersRepository } from './repositories/banners.repository';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [BannersController, AdminBannersController],
  providers: [
    BannersService,
    {
      provide: 'IBannersRepository',
      useClass: BannersRepository,
    },
  ],
  exports: [BannersService],
})
export class BannersModule {}
