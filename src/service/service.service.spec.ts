import { ListingCleanupService } from 'src/common/listing-cleanup/listing-cleanup.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceService } from './service.service';
import { Service } from './entities/service.entity';
import { ServiceImage } from './entities/service-image.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { ServiceViewService } from 'src/service-view/service-view.service';
import { SERVICE_QUE } from './service.constant';
import { PriceUnit } from './enums/price.enum';

describe('ServiceService', () => {
  let service: ServiceService;
  let serviceRepo: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let serviceStoreRepo: {
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    serviceRepo = {
      create: jest.fn((payload) => payload),
      save: jest.fn((payload) => ({ id: 'service-id', ...payload })),
    };
    serviceStoreRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceService,
        {
          provide: getRepositoryToken(Service),
          useValue: serviceRepo,
        },
        {
          provide: getRepositoryToken(ServiceImage),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ServiceStore),
          useValue: serviceStoreRepo,
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
      ],
    }).compile();

    service = module.get<ServiceService>(ServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sets isActive from the selected store subscription status when creating', async () => {
    serviceStoreRepo.findOne.mockResolvedValue({
      id: 'store-id',
      hasActiveSubscription: true,
    });

    const result = await service.create({
      title: 'Cleaning',
      storeId: 'store-id',
      price: 1000,
      priceUnit: PriceUnit.HOURLY,
    });

    expect(serviceStoreRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'store-id' },
      select: ['id', 'hasActiveSubscription'],
    });
    expect(serviceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({ id: 'service-id', isActive: true }),
    );
  });
});
