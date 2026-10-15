import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductViewService } from './product-view.service';
import { ProductView } from './entities/product-view.entity';
import { Product } from 'src/product/entities/product.entity';
import {
  PRODUCT_VIEWING_JOB,
  PRODUCT_QUE,
} from 'src/product/product.constants';

describe('ProductViewService', () => {
  let service: ProductViewService;
  let productRepo: { findOne: jest.Mock };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    productRepo = { findOne: jest.fn() };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductViewService,
        { provide: getRepositoryToken(ProductView), useValue: {} },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getQueueToken(PRODUCT_QUE), useValue: queue },
      ],
    }).compile();

    service = module.get<ProductViewService>(ProductViewService);
  });

  it('queues a view job for a viewer who is not the owner', async () => {
    productRepo.findOne.mockResolvedValue({
      id: 'item-id',
      userId: 'owner-id',
    });

    await expect(service.recordView('item-id', 'viewer-id')).resolves.toEqual({
      status: 'success',
      message: 'View recorded',
    });

    expect(queue.add).toHaveBeenCalledWith(
      PRODUCT_VIEWING_JOB,
      { productId: 'item-id', userId: 'viewer-id' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it("doesn't count the owner viewing their own listing", async () => {
    productRepo.findOne.mockResolvedValue({
      id: 'item-id',
      userId: 'owner-id',
    });

    await service.recordView('item-id', 'owner-id');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('throws when the product does not exist', async () => {
    productRepo.findOne.mockResolvedValue(null);

    await expect(service.recordView('missing-id', 'viewer-id')).rejects.toThrow(
      NotFoundException,
    );

    expect(queue.add).not.toHaveBeenCalled();
  });
});
