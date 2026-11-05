import { Logger } from '@nestjs/common';

import { Order } from './entities/order.entity';
import { OrderGateway } from './order.gateway';

describe('OrderGateway', () => {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const redis = { mget: jest.fn() };
  const gateway = new OrderGateway(redis as never);
  Object.assign(gateway, { server: { to } });

  const order = {
    id: 'order-1',
    sellerId: 'seller-1',
    buyerId: 'buyer-1',
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
});
