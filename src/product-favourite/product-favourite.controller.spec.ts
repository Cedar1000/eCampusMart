import { Test, TestingModule } from '@nestjs/testing';
import { ProductFavouriteController } from './product-favourite.controller';
import { ProductFavouriteService } from './product-favourite.service';

describe('ProductFavouriteController', () => {
  let controller: ProductFavouriteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductFavouriteController],
      providers: [ProductFavouriteService],
    }).compile();

    controller = module.get<ProductFavouriteController>(ProductFavouriteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
