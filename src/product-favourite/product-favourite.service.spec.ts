import { Test, TestingModule } from '@nestjs/testing';
import { ProductFavouriteService } from './product-favourite.service';

describe('ProductFavouriteService', () => {
  let service: ProductFavouriteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductFavouriteService],
    }).compile();

    service = module.get<ProductFavouriteService>(ProductFavouriteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
