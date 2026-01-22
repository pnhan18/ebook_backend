import { Module, forwardRef } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { FavoritesRepository } from './repositories/favorites.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [
    FavoritesService,
    {
      provide: 'IFavoritesRepository',
      useClass: FavoritesRepository,
    },
  ],
  controllers: [FavoritesController],
  exports: [FavoritesService],
})
export class FavoritesModule { }
