import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getRepositoryToken(ServiceStore), useValue: {} },
        { provide: getRepositoryToken(Subscription), useValue: {} },
        { provide: getRepositoryToken(SubscriptionPlan), useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
