import { Logger } from '@nestjs/common';

import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderExpirySweep } from './order-expiry.sweep';

describe('OrderExpirySweep', () => {
  let updates: { target: unknown; fields: Record<string, unknown> }[];
  let expired: Partial<Order>[];
  let fail: boolean;
  let gateway: { notify: jest.Mock };
  let sweep: OrderExpirySweep;

  beforeEach(() => {
    updates = [];
    expired = [
      { id: 'order-1', productId: 'product-1', quantity: 2 },
      { id: 'order-2', productId: 'product-2', quantity: 1 },
    ];
    fail = false;

    const repo = {
      createQueryBuilder: () => {
        const update = { target: undefined as unknown, fields: {} };
        const builder = {
          update: (target: unknown) => ((update.target = target), builder),
          set: (fields: Record<string, unknown>) => (
            (update.fields = fields),
            builder
          ),
          where: () => builder,
          returning: () => builder,
          execute: () => {
            if (fail) throw new Error('db down');
            updates.push(update);
            return { raw: expired, affected: expired.length };
          },
        };
        return builder;
      },
    };

    gateway = { notify: jest.fn() };
    sweep = new OrderExpirySweep(repo as never, gateway as never);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  it('expires pending orders without touching their products', async () => {
    await sweep.sweep();

    expect(updates).toEqual([
      { target: Order, fields: { status: OrderStatus.EXPIRED } },
    ]);
  });

  it('tells both sides of each expired order', async () => {
    await sweep.sweep();

    expect(gateway.notify.mock.calls).toEqual([
      [expired[0], 'expired'],
      [expired[1], 'expired'],
    ]);
  });

  it('logs a failure instead of throwing', async () => {
    fail = true;
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(sweep.sweep()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    expect(gateway.notify).not.toHaveBeenCalled();
  });
});
