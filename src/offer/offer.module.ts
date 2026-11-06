import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferService } from './offer.service';
import { OfferGateway } from './offer.gateway';
import { OfferController } from './offer.controller';
import { Offer } from './entities/offer.entity';
import { OrderModule } from 'src/order/order.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([Offer]), OrderModule, NotificationModule],
  controllers: [OfferController],
  providers: [OfferService, OfferGateway],
})
export class OfferModule {}
