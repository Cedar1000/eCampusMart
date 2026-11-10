import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import { User } from 'src/auth/entities/user.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { IncludeReviewListingsInterceptor } from './include-review-listings.interceptor';

describe('IncludeReviewListingsInterceptor', () => {
  const product = { id: 'product-1', name: 'iphone 12', photo: null };
  const listings = {
    attach: jest.fn((rows: { productId?: string }[]) =>
      rows.map((row) => (row.productId ? { ...row, product } : row)),
    ),
  };
  const manager = {
    find: jest.fn((entity: unknown) => {
      if (entity === User) {
        return [
          {
            id: 'buyer-1',
            firstName: 'Ada',
            lastName: 'Obi',
            photo: 'ada.png',
          },
          { id: 'seller-1', firstName: 'Dave', lastName: 'East' },
        ];
      }
      if (entity === ProductStore) {
        return [{ id: 'store-1', name: 'Gadget Hub', logo: 'hub.png' }];
      }
      if (entity === ServiceStore) {
        return [{ id: 'cuts-1', name: 'Ada Cuts', logo: null }];
      }
      return [];
    }),
  };
  const orderRepo = {
    find: jest.fn(() => [{ id: 'order-1', amount: '7500050' }]),
    manager,
  };
  const interceptor = new IncludeReviewListingsInterceptor(
    listings as never,
    orderRepo as never,
  );

  const run = (response: unknown) =>
    lastValueFrom(
      interceptor.intercept(
        {} as ExecutionContext,
        { handle: () => of(response) } as CallHandler,
      ),
    );

  const buyer = {
    id: 'buyer-1',
    name: 'Ada Obi',
    photo: 'ada.png',
    type: 'user',
  };
  const seller = {
    id: 'seller-1',
    name: 'Dave East',
    photo: null,
    type: 'user',
  };
  const store = {
    id: 'store-1',
    name: 'Gadget Hub',
    photo: 'hub.png',
    type: 'product-store',
  };

  // The buyer's pending review of a store order
  const pending = {
    id: 'pending-1',
    orderId: 'order-1',
    productId: 'product-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    senderId: 'buyer-1',
    senderIsStore: false,
    receiverId: 'store-1',
    receiverIsStore: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it("adds the product, the order's amount in naira and who's involved", async () => {
    const result = await run({ status: 'success', data: [pending] });

    expect(result).toMatchObject({ status: 'success' });
    expect(result.data).toEqual([
      {
        ...pending,
        product,
        amount: 75000.5,
        buyer,
        seller,
        sender: buyer,
        receiver: store,
      },
    ]);
  });

  it('shows a store sender, and a service store', async () => {
    const result = await run({
      data: [
        {
          ...pending,
          senderId: 'store-1',
          senderIsStore: true,
          receiverId: 'buyer-1',
          receiverIsStore: false,
        },
        {
          ...pending,
          id: 'review-2',
          orderId: null,
          productId: null,
          receiverId: 'cuts-1',
        },
      ],
    });

    expect(result.data![0]).toMatchObject({ sender: store, receiver: buyer });
    expect(result.data![1]).toMatchObject({
      amount: null,
      receiver: { id: 'cuts-1', name: 'Ada Cuts', type: 'service-store' },
    });
  });

  it('leaves an empty list alone', async () => {
    await expect(run({ data: [] })).resolves.toEqual({ data: [] });
    expect(orderRepo.find).not.toHaveBeenCalled();
    expect(manager.find).not.toHaveBeenCalled();
  });
});
