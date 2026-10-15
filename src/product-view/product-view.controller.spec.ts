import { Test, TestingModule } from '@nestjs/testing';
import { ProductViewController } from './product-view.controller';
import { ProductViewService } from './product-view.service';
import { User } from 'src/auth/entities/user.entity';

describe('ProductViewController', () => {
  let controller: ProductViewController;
  let viewService: { recordView: jest.Mock };

  beforeEach(async () => {
    viewService = { recordView: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductViewController],
      providers: [{ provide: ProductViewService, useValue: viewService }],
    }).compile();

    controller = module.get<ProductViewController>(ProductViewController);
  });

  it('records the view for the signed-in user', async () => {
    await controller.create({ productId: 'item-id' }, {
      id: 'viewer-id',
    } as User);

    expect(viewService.recordView).toHaveBeenCalledWith('item-id', 'viewer-id');
  });
});
