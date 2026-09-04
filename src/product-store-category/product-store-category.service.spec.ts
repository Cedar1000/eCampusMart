import { Test, TestingModule } from '@nestjs/testing';
import { ProductStoreCategoryService } from './product-store-category.service';

describe('ProductStoreCategoryService', () => {
  let service: ProductStoreCategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductStoreCategoryService],
    }).compile();

    service = module.get<ProductStoreCategoryService>(ProductStoreCategoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
