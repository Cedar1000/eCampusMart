import { ListingCleanupService } from 'src/common/listing-cleanup/listing-cleanup.service';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceStore } from './entities/service-store.entity';
import { ServiceStoreService } from './service-store.service';

describe('ServiceStoreService', () => {
  let service: ServiceStoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceStoreService,
        {
          provide: getRepositoryToken(ServiceStore),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: {},
        },
        { provide: ListingCleanupService, useValue: {} },
      ],
    }).compile();

    service = module.get<ServiceStoreService>(ServiceStoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
