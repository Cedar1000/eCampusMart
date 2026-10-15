import { ListingCleanupService } from 'src/common/listing-cleanup/listing-cleanup.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceService } from './service.service';
import { Service } from './entities/service.entity';
import { ServiceImage } from './entities/service-image.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { ServiceViewService } from 'src/service-view/service-view.service';
import { SERVICE_QUE, SERVICE_STORE_COUNT_JOB } from './service.constant';
import { PriceUnit } from './enums/price.enum';

describe('ServiceService', () => {
  let service: ServiceService;
  let serviceRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    countBy?: jest.Mock;
  };
  let serviceStoreRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    exists: jest.Mock;
  };
  let serviceQueue: { add: jest.Mock };

  beforeEach(async () => {
    serviceRepo = {
      create: jest.fn((payload) => payload),
      save: jest.fn((payload) => ({ id: 'service-id', ...payload })),
      find: jest.fn(() => []),
      count: jest.fn(() => 0),
    };
    serviceStoreRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      exists: jest.fn(() => false),
    };
    serviceQueue = { add: jest.fn() };

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
          useValue: serviceQueue,
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

  describe('listing services', () => {
    const where = () =>
      JSON.stringify(
        (serviceRepo.find.mock.calls[0] as [{ where: unknown }])[0].where,
      );

    it('only shows buyers listed, active services', async () => {
      await service.findListed({}, 'buyer-1');

      expect(where()).toContain('isActive');
      expect(where()).toContain('status');
    });

    it('shows sellers all of their own services by owner', async () => {
      await service.findListed({ ownerId: 'owner-1' }, 'owner-1');

      expect(where()).not.toContain('isActive');
    });

    it("shows sellers all of their own store's services", async () => {
      serviceStoreRepo.exists.mockReturnValue(true);

      await service.findListed({ storeId: 'store-1' }, 'owner-1');

      expect(serviceStoreRepo.exists).toHaveBeenCalledWith({
        where: { id: 'store-1', ownerId: 'owner-1' },
      });
      expect(where()).not.toContain('isActive');
    });

    it("hides another seller's unlisted services by store", async () => {
      await service.findListed({ storeId: 'store-1' }, 'buyer-1');

      expect(where()).toContain('isActive');
    });
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
    expect(serviceQueue.add).toHaveBeenCalledWith(
      SERVICE_STORE_COUNT_JOB,
      { storeId: 'store-id' },
      expect.any(Object),
    );
  });

  it("recounts the store's services", async () => {
    serviceRepo.countBy = jest.fn().mockResolvedValue(4);

    await service.calculateStoreServicesCount({ storeId: 'store-id' });

    expect(serviceRepo.countBy).toHaveBeenCalledWith({ storeId: 'store-id' });
    expect(serviceStoreRepo.update).toHaveBeenCalledWith(
      { id: 'store-id' },
      { servicesCount: 4 },
    );
  });
});
