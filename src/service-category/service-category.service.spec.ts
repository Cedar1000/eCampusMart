import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceCategory } from './entities/service-category.entity';
import { ServiceCategoryService } from './service-category.service';

describe('ServiceCategoryService', () => {
  let service: ServiceCategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceCategoryService,
        {
          provide: getRepositoryToken(ServiceCategory),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ServiceCategoryService>(ServiceCategoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
