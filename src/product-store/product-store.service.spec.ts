import { Test, TestingModule } from '@nestjs/testing';
import { ProductStoreService } from './product-store.service';

describe('ProductStoreService', () => {
  let service: ProductStoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductStoreService],
    }).compile();

    service = module.get<ProductStoreService>(ProductStoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
