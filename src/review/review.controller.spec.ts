import { Test, TestingModule } from '@nestjs/testing';

import { ReviewController } from './review.controller';
import { IncludeReviewListingsInterceptor } from './interceptors/include-review-listings.interceptor';
import { ReviewService } from './review.service';

describe('ReviewController', () => {
  let controller: ReviewController;
  const reviewService = {
    findAll: jest.fn(),
    findAllPending: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [{ provide: ReviewService, useValue: reviewService }],
    })
      .overrideInterceptor(IncludeReviewListingsInterceptor)
      .useValue({ intercept: jest.fn() })
      .compile();

    controller = module.get<ReviewController>(ReviewController);
  });

  it('passes the query through', async () => {
    await controller.findAll({ page: '1' });
    await controller.findAllPending({ page: '1' }, { id: 'buyer-1' } as never);

    expect(reviewService.findAll).toHaveBeenCalledWith({ page: '1' });
    expect(reviewService.findAllPending).toHaveBeenCalledWith(
      { page: '1' },
      'buyer-1',
    );
  });

  it('writes the review as the signed-in user', async () => {
    const dto = { pendingReviewId: 'pending-1', rating: 4 };

    await controller.create(dto, { id: 'buyer-1' } as never);

    expect(reviewService.create).toHaveBeenCalledWith(dto, 'buyer-1');
  });
});
