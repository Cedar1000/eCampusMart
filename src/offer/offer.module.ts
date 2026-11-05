import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferService } from './offer.service';
import { OfferController } from './offer.controller';
import { Offer } from './entities/offer.entity';
import { OrderModule } from 'src/order/order.module';

@Module({
  imports: [TypeOrmModule.forFeature([Offer]), OrderModule],
  controllers: [OfferController],
  providers: [OfferService],
})
export class OfferModule {}
