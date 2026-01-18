import { Module, forwardRef } from '@nestjs/common';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { ChaptersRepository } from './repositories/chapters.repository';
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [UsersModule, forwardRef(() => PaymentsModule)],
  controllers: [ChaptersController],
  providers: [
    ChaptersService,
    {
      provide: 'IChaptersRepository',
      useClass: ChaptersRepository,
    },
  ],
  exports: [ChaptersService],
})
export class ChaptersModule { }

