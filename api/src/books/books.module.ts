import { Module, forwardRef } from '@nestjs/common';
import { BooksController, AdminBooksController } from './books.controller';
import { BooksService } from './books.service';
import { BooksRepository } from './repositories/books.repository';
import { SearchModule } from '../search/search.module';
import { StorageModule } from '../storage/storage.module';
import { BooksSearchService } from './search/books-search.service';
import { FavoritesModule } from '../favorites/favorites.module';
import { RatingsModule } from '../ratings/ratings.module';

@Module({
  imports: [SearchModule, StorageModule, FavoritesModule, RatingsModule],
  controllers: [BooksController, AdminBooksController],
  providers: [BooksService, BooksRepository, BooksSearchService],
  exports: [BooksService, BooksSearchService, BooksRepository],
})
export class BooksModule {}
