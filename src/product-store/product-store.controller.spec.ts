import { Test, TestingModule } from '@nestjs/testing';
import { ProductStoreController } from './product-store.controller';
import { ProductStoreService } from './product-store.service';

describe('ProductStoreController', () => {
  let controller: ProductStoreController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductStoreController],
      providers: [ProductStoreService],
    }).compile();

    controller = module.get<ProductStoreController>(ProductStoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
