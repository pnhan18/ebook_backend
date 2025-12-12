import { Module } from '@nestjs/common';
import { AuthorsService } from './authors.service';
import { AuthorsController } from './authors.controller';
import { AuthorsRepository } from './repositories/authors.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [AuthorsService, AuthorsRepository],
  controllers: [AuthorsController],
  exports: [AuthorsService],
})
export class AuthorsModule {}
