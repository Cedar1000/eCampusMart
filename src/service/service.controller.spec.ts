import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';
import { Service } from './entities/service.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';

describe('ServiceController', () => {
  let controller: ServiceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceController],
      providers: [
        ServiceService,
        {
          provide: getRepositoryToken(Service),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ServiceStore),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ServiceCategory),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ServiceController>(ServiceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
