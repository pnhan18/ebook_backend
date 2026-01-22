import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    StorageModule,
  ],
  controllers: [AudioController],
  providers: [AudioService],
})
export class AudioModule { }
