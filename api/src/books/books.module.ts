import { Module } from '@nestjs/common';
import { BooksController, AdminBooksController } from './books.controller';
import { BooksService } from './books.service';
import { BooksRepository } from './repositories/books.repository';
import { SearchModule } from '../search/search.module';
import { StorageModule } from '../storage/storage.module';
import { BooksSearchService } from './search/books-search.service';

@Module({
  imports: [SearchModule, StorageModule],
  controllers: [BooksController, AdminBooksController],
  providers: [BooksService, BooksRepository, BooksSearchService],
  exports: [BooksService, BooksSearchService],
})
export class BooksModule {}
