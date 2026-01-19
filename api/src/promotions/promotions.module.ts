import { Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { PromotionRepository } from './repositories/promotion.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PromotionsController],
    providers: [
        PromotionsService,
        {
            provide: 'IPromotionRepository',
            useClass: PromotionRepository,
        },
    ],
    exports: [PromotionsService],
})
export class PromotionsModule { }
