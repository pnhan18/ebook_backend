import { Module } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersService } from './users.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [
    UsersService,
    {
      provide: 'IUsersRepository',
      useClass: UsersRepository,
    },
  ],
  exports: [UsersService],
})
export class UsersModule { }