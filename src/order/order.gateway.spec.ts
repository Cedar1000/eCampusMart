import { Logger } from '@nestjs/common';

import { Order } from './entities/order.entity';
import { OrderGateway } from './order.gateway';

describe('OrderGateway', () => {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const redis = { mget: jest.fn() };
  const products = { findOne: jest.fn(() => ({ name: 'iphone 12' })) };
  const users = {
    findOne: jest.fn(() => ({ firstName: 'Ada', lastName: 'Obi' })),
  };
  const push = { send: jest.fn() };
  const gateway = new OrderGateway(
    redis as never,
    products as never,
    users as never,
    push as never,
  );
  Object.assign(gateway, { server: { to } });

  const order = {
    id: 'order-1',
    sellerId: 'seller-1',
    buyerId: 'buyer-1',
    productId: 'product-1',
    quantity: 1,
    amount: 7500050,
  } as Order;

  beforeEach(() => jest.clearAllMocks());

  it('sends order-updated to the online seller and buyer, in naira', async () => {
    redis.mget.mockResolvedValue(['socket-seller', 'socket-buyer']);

    await gateway.notify(order, 'placed');

    expect(redis.mget).toHaveBeenCalledWith('user-seller-1', 'user-buyer-1');
    expect(to.mock.calls).toEqual([['socket-seller'], ['socket-buyer']]);
    expect(emit).toHaveBeenCalledWith('order-updated', {
      action: 'placed',
      order: { ...order, amount: 75000.5 },
    });
  });

  it('skips whoever is offline', async () => {
    redis.mget.mockResolvedValue(['socket-seller', null]);

    await gateway.notify(order, 'cancelled');

    expect(to.mock.calls).toEqual([['socket-seller']]);
  });

  it("doesn't throw when Redis fails", async () => {
    redis.mget.mockRejectedValue(new Error('redis down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(gateway.notify(order, 'completed')).resolves.toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });

  describe('push', () => {
    beforeEach(() => redis.mget.mockResolvedValue([null, null]));

    it('pushes a new order to the seller, not the buyer who placed it', async () => {
      await gateway.notify({ ...order, quantity: 2 }, 'placed', 'buyer-1');

      expect(push.send).toHaveBeenCalledWith(['seller-1'], {
        title: 'New order',
        body: 'Ada Obi ordered 2 × iphone 12',
        data: { type: 'order-updated', orderId: 'order-1', action: 'placed' },
      });
    });

    it('pushes a cancellation by the seller to the buyer', async () => {
      await gateway.notify(order, 'cancelled', 'seller-1');

      expect(push.send).toHaveBeenCalledWith(['buyer-1'], {
        title: 'Order cancelled',
        body: 'The order for iphone 12 was cancelled',
        data: {
          type: 'order-updated',
          orderId: 'order-1',
          action: 'cancelled',
        },
      });
    });

    it('pushes an expiry to both sides', async () => {
      await gateway.notify(order, 'expired');

      expect(push.send).toHaveBeenCalledWith(
        ['seller-1', 'buyer-1'],
        expect.objectContaining({ title: 'Order expired' }),
      );
    });

    it("doesn't throw when the push fails", async () => {
      push.send.mockRejectedValue(new Error('expo down'));
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(gateway.notify(order, 'completed')).resolves.toBeUndefined();
    });
  });
});
