import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';
import { Offer } from './entities/offer.entity';
import { OrderService } from 'src/order/order.service';
import { OfferGateway } from './offer.gateway';
import { PushService } from 'src/notification/push.service';

describe('OfferController', () => {
  let controller: OfferController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OfferController],
      providers: [
        OfferService,
        { provide: getRepositoryToken(Offer), useValue: {} },
        { provide: OrderService, useValue: {} },
        { provide: OfferGateway, useValue: {} },
        { provide: PushService, useValue: {} },
      ],
    }).compile();

    controller = module.get<OfferController>(OfferController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
