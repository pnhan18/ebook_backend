import { Module } from '@nestjs/common';
import { BooksController, AdminBooksController } from './books.controller';
import { BooksService } from './books.service';
import { BooksRepository } from './repositories/books.repository';

@Module({
  controllers: [BooksController, AdminBooksController],
  providers: [BooksService, BooksRepository],
  exports: [BooksService],
})
export class BooksModule {}
