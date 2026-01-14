import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './repositories/categories.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchModule } from '../search/search.module';
import { CategoriesSearchService } from './search/categories-search.service';

@Module({
  imports: [PrismaModule, SearchModule],
  providers: [
    CategoriesService,
    {
      provide: 'ICategoriesRepository',
      useClass: CategoriesRepository,
    },
    CategoriesSearchService,
  ],
  controllers: [CategoriesController],
  exports: [CategoriesService, CategoriesSearchService],
})
export class CategoriesModule {}
