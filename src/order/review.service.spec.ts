import { In } from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { OrderRatingRole, RateeType } from './entities/order-rating.entity';
import { Order } from './entities/order.entity';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  let storeIds: string[];
  let where: string;
  const findAndCount = jest.fn();
  const rows = [
    { stars: 5, count: '3' },
    { stars: 4, count: '1' },
  ];

  const manager = {
    find: jest.fn((entity: unknown) => {
      if (entity === ProductStore && storeIds) {
        return storeIds.map((id) => ({ id, name: 'Gadget Hub', logo: null }));
      }
      if (entity === User) {
        return [
          { id: 'ada', firstName: 'Ada', lastName: 'Obi', photo: 'a.jpg' },
          { id: 'me', firstName: 'Chidi', lastName: 'Okafor', photo: null },
        ];
      }
      if (entity === Order) {
        return [{ id: 'order-1', orderId: 'ORD-1', productId: 'product-1' }];
      }
      if (entity === Product) return [{ id: 'product-1', name: 'iphone 12' }];
      return [];
    }),
  };
  const builder = {
    select: () => builder,
    addSelect: () => builder,
    where: (sql: string) => ((where = sql), builder),
    groupBy: () => builder,
    getRawMany: () => rows,
  };

  const service = new ReviewService({
    findAndCount,
    manager,
    createQueryBuilder: () => builder,
  } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    storeIds = [];
    findAndCount.mockResolvedValue([
      [
        {
          id: 'rating-1',
          orderId: 'order-1',
          raterId: 'ada',
          raterRole: OrderRatingRole.BUYER,
          rateeId: 'me',
          rateeType: RateeType.USER,
          stars: 5,
          comment: 'Quick pickup',
        },
      ],
      1,
    ]);
  });

  it('lists reviews of the user, with the rater and the item', async () => {
    const result = await service.received('me', {});

    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [{ rateeId: 'me', rateeType: RateeType.USER }],
        skip: 0,
        take: 10,
      }),
    );
    expect(result).toMatchObject({ count: 1, pages: 1, nextPage: null });
    expect(result.data[0]).toMatchObject({
      stars: 5,
      rater: { id: 'ada', name: 'Ada Obi', photo: 'a.jpg' },
      ratee: { id: 'me', name: 'Chidi Okafor' },
      order: { orderId: 'ORD-1', product: { name: 'iphone 12' } },
    });
  });

  it("includes reviews of the user's product stores", async () => {
    storeIds = ['store-1'];

    await service.received('me', { page: '2', limit: '5' });

    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          { rateeId: 'me', rateeType: RateeType.USER },
          { rateeId: In(['store-1']), rateeType: RateeType.PRODUCT_STORE },
        ],
        skip: 5,
        take: 5,
      }),
    );
  });

  it('lists the reviews the user wrote', async () => {
    await service.given('ada', {});

    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: [{ raterId: 'ada' }] }),
    );
  });

  it('sums up the stars received', async () => {
    const { data } = await service.summary('me');

    expect(data).toEqual({
      userId: 'me',
      average: 4.8,
      count: 4,
      breakdown: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 3 },
    });
    expect(where).not.toContain('storeIds');
  });

  it("counts the stores' reviews in the summary", async () => {
    storeIds = ['store-1'];

    await service.summary('me');

    expect(where).toContain('IN (:...storeIds)');
  });
});
