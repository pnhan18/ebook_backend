import { Module } from '@nestjs/common';
import { AuthorsService } from './authors.service';
import { AuthorsController } from './authors.controller';
import { AuthorsRepository } from './repositories/authors.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { SearchModule } from '../search/search.module';
import { AuthorsSearchService } from './search/authors-search.service';

@Module({
  imports: [PrismaModule, StorageModule, SearchModule],
  providers: [
    AuthorsService,
    {
      provide: 'IAuthorsRepository',
      useClass: AuthorsRepository,
    },
    AuthorsSearchService,
  ],
  controllers: [AuthorsController],
  exports: [AuthorsService, AuthorsSearchService],
})
export class AuthorsModule {}
