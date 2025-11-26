import { Module } from '@nestjs/common';
import { AuthorsService } from './authors.service';
import { AuthorsController } from './authors.controller';
import { AuthorsRepository } from './repositories/authors.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AuthorsService, AuthorsRepository],
  controllers: [AuthorsController],
  exports: [AuthorsService],
})
export class AuthorsModule {}
