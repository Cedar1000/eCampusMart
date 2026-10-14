import { ListingCleanupService } from 'src/common/listing-cleanup/listing-cleanup.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';
import { Service } from './entities/service.entity';
import { ServiceImage } from './entities/service-image.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { ServiceViewService } from 'src/service-view/service-view.service';
import { SERVICE_QUE } from './service.constant';
import { RedisService } from 'src/redis/redis.service';

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
          provide: getRepositoryToken(ServiceImage),
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
        {
          provide: getQueueToken(SERVICE_QUE),
          useValue: {},
        },
        { provide: ListingCleanupService, useValue: {} },
        {
          provide: ServiceViewService,
          useValue: {},
        },
        {
          provide: RedisService,
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
