import { Logger } from '@nestjs/common';

import { Product } from 'src/product/entities/product.entity';
import { ProductStatus } from 'src/product/enums/product-status.enum';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderExpirySweep } from './order-expiry.sweep';

describe('OrderExpirySweep', () => {
  let updates: { target: unknown; fields: Record<string, unknown> }[];
  let params: Record<string, unknown>[];
  let expired: { productId: string; quantity: number }[];
  let fail: boolean;
  let gateway: { notify: jest.Mock };
  let sweep: OrderExpirySweep;

  beforeEach(() => {
    updates = [];
    params = [];
    expired = [
      { productId: 'product-1', quantity: 2 },
      { productId: 'product-2', quantity: 1 },
    ];
    fail = false;

    const manager = {
      createQueryBuilder: () => {
        const update = { target: undefined as unknown, fields: {} };
        const builder = {
          update: (target: unknown) => ((update.target = target), builder),
          set: (fields: Record<string, unknown>) => (
            (update.fields = fields),
            builder
          ),
          where: (_: string, values: Record<string, unknown>) => (
            params.push(values),
            builder
          ),
          returning: () => builder,
          execute: () => {
            if (fail) throw new Error('db down');
            updates.push(update);
            return update.target === Order
              ? { raw: expired, affected: expired.length }
              : { affected: 1 };
          },
        };
        return builder;
      },
    };
    const repo = {
      manager: {
        transaction: (run: (m: unknown) => unknown) => run(manager),
      },
    };

    gateway = { notify: jest.fn() };
    sweep = new OrderExpirySweep(repo as never, gateway as never);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  it('expires pending orders, then returns their units to each product', async () => {
    await sweep.sweep();

    expect(updates.map(({ target }) => target)).toEqual([
      Order,
      Product,
      Product,
    ]);
    expect(updates[0].fields).toEqual({ status: OrderStatus.EXPIRED });
    expect(updates[1].fields).toMatchObject({ status: ProductStatus.ACTIVE });
    expect(params.slice(1)).toEqual([
      expect.objectContaining({ productId: 'product-1', quantity: 2 }),
      expect.objectContaining({ productId: 'product-2', quantity: 1 }),
    ]);
    expect(gateway.notify.mock.calls).toEqual([
      [expired[0], 'expired'],
      [expired[1], 'expired'],
    ]);
  });

  it('touches no product when nothing expired', async () => {
    expired = [];

    await sweep.sweep();

    expect(updates.map(({ target }) => target)).toEqual([Order]);
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
