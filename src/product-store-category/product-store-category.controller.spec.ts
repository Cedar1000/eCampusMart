import { Test, TestingModule } from '@nestjs/testing';
import { ProductStoreCategoryController } from './product-store-category.controller';
import { ProductStoreCategoryService } from './product-store-category.service';

describe('ProductStoreCategoryController', () => {
  let controller: ProductStoreCategoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductStoreCategoryController],
      providers: [ProductStoreCategoryService],
    }).compile();

    controller = module.get<ProductStoreCategoryController>(ProductStoreCategoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
