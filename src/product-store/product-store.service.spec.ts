import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductStoreService } from './product-store.service';
import { ProductStore } from './entities/product-store.entity';

describe('ProductStoreService', () => {
  let service: ProductStoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductStoreService,
        {
          provide: getRepositoryToken(ProductStore),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ProductStoreService>(ProductStoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
