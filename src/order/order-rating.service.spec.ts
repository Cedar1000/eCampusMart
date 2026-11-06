import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import {
  OrderRating,
  OrderRatingRole,
  RateeType,
} from './entities/order-rating.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderRatingService } from './order-rating.service';

describe('OrderRatingService', () => {
  let order: Partial<Order> | null;
  let ratings: Partial<OrderRating>[];
  let averages: { target: unknown; id: string; stars: number }[];
  let push: { send: jest.Mock };
  let notifications: { create: jest.Mock };
  let service: OrderRatingService;

  const rate = (user: string, stars = 5, comment?: string) =>
    service.rate('order-1', { stars, comment }, user);

  beforeEach(() => {
    order = {
      id: 'order-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      isStoreOrder: false,
      storeId: undefined,
      status: OrderStatus.COMPLETED,
    };
    ratings = [];
    averages = [];

    const manager = {
      create: jest.fn((_entity: unknown, row: object) => row),
      // Like the unique (orderId, raterId) constraint
      save: jest.fn((row: Partial<OrderRating>) => {
        if (
          ratings.some(
            (r) => r.orderId === row.orderId && r.raterId === row.raterId,
          )
        ) {
          throw Object.assign(new QueryFailedError('INSERT', [], new Error()), {
            code: '23505',
          });
        }
        const saved = { id: `rating-${ratings.length + 1}`, ...row };
        ratings.push(saved);
        return saved;
      }),
      findOne: jest.fn(({ name }: { name: string }) =>
        name === User.name ? { id: 'buyer-1', firstName: 'Ada' } : null,
      ),
      createQueryBuilder: () => {
        const update = { target: undefined as unknown, id: '', stars: 0 };
        const builder = {
          update: (target: unknown) => ((update.target = target), builder),
          set: () => builder,
          where: (_: string, params: { id: string; stars: number }) => (
            Object.assign(update, params),
            builder
          ),
          execute: () => averages.push(update),
        };
        return builder;
      },
    };

    push = { send: jest.fn() };
    notifications = { create: jest.fn() };
    service = new OrderRatingService(
      { findOneBy: jest.fn(() => order && { ...order }) } as never,
      {
        manager: {
          ...manager,
          transaction: (run: (m: typeof manager) => unknown) => run(manager),
        },
        find: jest.fn(() => ratings),
      } as never,
      push as never,
      notifications as never,
    );
  });

  it('lets the buyer rate the seller and returns both sides on the order', async () => {
    const result = await rate('buyer-1', 4, '  quick pickup, no stress.  ');

    expect(ratings).toEqual([
      expect.objectContaining({
        raterId: 'buyer-1',
        raterRole: OrderRatingRole.BUYER,
        rateeId: 'seller-1',
        rateeType: RateeType.USER,
        stars: 4,
        comment: 'quick pickup, no stress.',
      }),
    ]);
    expect(result.data.ratings).toEqual({
      buyer: expect.objectContaining({ stars: 4 }) as OrderRating,
      seller: null,
    });
  });

  it('adds the rating to the rated user’s average', async () => {
    await rate('buyer-1', 4);

    expect(averages).toEqual([{ target: User, id: 'seller-1', stars: 4 }]);
  });

  it('rates the store, not its owner, for a store order', async () => {
    Object.assign(order!, { isStoreOrder: true, storeId: 'store-1' });

    await rate('buyer-1');

    expect(ratings[0]).toMatchObject({
      rateeId: 'store-1',
      rateeType: RateeType.PRODUCT_STORE,
    });
    expect(averages).toEqual([
      { target: ProductStore, id: 'store-1', stars: 5 },
    ]);
  });

  it('lets the seller rate the buyer', async () => {
    await rate('seller-1', 3);

    expect(ratings[0]).toMatchObject({
      raterRole: OrderRatingRole.SELLER,
      rateeId: 'buyer-1',
      rateeType: RateeType.USER,
    });
  });

  it('tells the rated person with a push and a saved notification', async () => {
    await rate('buyer-1', 5);

    expect(push.send).toHaveBeenCalledWith(['seller-1'], {
      title: 'New review',
      body: 'Ada rated you 5 stars',
      data: { type: 'review-received', orderId: 'order-1', stars: 5 },
    });
    expect(notifications.create).toHaveBeenCalledWith({
      userId: 'seller-1',
      type: NotificationType.REVIEW_RECEIVED,
      title: 'New review',
      body: 'Ada rated you 5 stars',
      data: { orderId: 'order-1', stars: 5, ratingId: 'rating-1' },
    });
  });

  it('says "1 star" for a single star', async () => {
    await rate('buyer-1', 1);

    expect(push.send).toHaveBeenCalledWith(
      ['seller-1'],
      expect.objectContaining({ body: 'Ada rated you 1 star' }),
    );
  });

  it('tells a store order’s owner, who is the seller', async () => {
    Object.assign(order!, { isStoreOrder: true, storeId: 'store-1' });

    await rate('buyer-1');

    expect(push.send).toHaveBeenCalledWith(['seller-1'], expect.anything());
  });

  it('refuses a second rating from the same side', async () => {
    await rate('buyer-1');

    await expect(rate('buyer-1')).rejects.toThrow(ConflictException);
    expect(averages).toHaveLength(1);
  });

  it.each([OrderStatus.PENDING, OrderStatus.CANCELLED, OrderStatus.EXPIRED])(
    'refuses an order that is %s',
    async (status) => {
      order!.status = status;

      await expect(rate('buyer-1')).rejects.toThrow(BadRequestException);
      expect(ratings).toHaveLength(0);
    },
  );

  it('refuses anyone but the buyer or seller', async () => {
    await expect(rate('someone-else')).rejects.toThrow(ForbiddenException);
  });

  it('returns 404 for an unknown order', async () => {
    order = null;

    await expect(rate('buyer-1')).rejects.toThrow(NotFoundException);
  });

  it('still saves the rating when the notice fails', async () => {
    push.send.mockRejectedValue(new Error('expo down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(rate('buyer-1')).resolves.toMatchObject({
      status: 'success',
    });
    expect(ratings).toHaveLength(1);
  });

  it('finds both sides for each order, null where a side has not rated', async () => {
    ratings = [
      { orderId: 'order-1', raterRole: OrderRatingRole.SELLER, stars: 2 },
    ];

    await expect(service.findRatings(['order-1', 'order-2'])).resolves.toEqual({
      'order-1': { buyer: null, seller: ratings[0] },
      'order-2': { buyer: null, seller: null },
    });
  });
});
