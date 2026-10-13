import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubscriptionPlanService } from './subscription-plan.service';
import { SubscriptionPlan } from './entities/subscription-plan.entity';

describe('SubscriptionPlanService', () => {
  let service: SubscriptionPlanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPlanService,
        {
          provide: getRepositoryToken(SubscriptionPlan),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SubscriptionPlanService>(SubscriptionPlanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
