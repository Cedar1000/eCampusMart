import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductStoreController } from './product-store.controller';
import { ProductStoreService } from './product-store.service';
import { ProductStore } from './entities/product-store.entity';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';

describe('ProductStoreController', () => {
  let controller: ProductStoreController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductStoreController],
      providers: [
        ProductStoreService,
        {
          provide: getRepositoryToken(ProductStore),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ProductCategory),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ProductStoreController>(ProductStoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
