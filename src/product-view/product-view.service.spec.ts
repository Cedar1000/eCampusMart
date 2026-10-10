import { Test, TestingModule } from '@nestjs/testing';
import { ProductViewService } from './product-view.service';

describe('ProductViewService', () => {
  let service: ProductViewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductViewService],
    }).compile();

    service = module.get<ProductViewService>(ProductViewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
