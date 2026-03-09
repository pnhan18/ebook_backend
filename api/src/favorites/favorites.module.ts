import { Module, forwardRef } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { FavoritesRepository } from './repositories/favorites.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
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
export class FavoritesModule {}
