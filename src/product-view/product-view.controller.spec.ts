import { Test, TestingModule } from '@nestjs/testing';
import { ProductViewController } from './product-view.controller';
import { ProductViewService } from './product-view.service';

describe('ProductViewController', () => {
  let controller: ProductViewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductViewController],
      providers: [ProductViewService],
    }).compile();

    controller = module.get<ProductViewController>(ProductViewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
