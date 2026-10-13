import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlanController } from './subscription-plan.controller';
import { SubscriptionPlanService } from './subscription-plan.service';

describe('SubscriptionPlanController', () => {
  let controller: SubscriptionPlanController;
  let service: {
    findAll: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionPlanController],
      providers: [
        {
          provide: SubscriptionPlanService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<SubscriptionPlanController>(
      SubscriptionPlanController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('gets all plans with query params', () => {
    const query = { limit: '10', page: '1' };

    controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
  });
});
