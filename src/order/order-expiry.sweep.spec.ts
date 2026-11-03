import { Logger } from '@nestjs/common';

import { Product } from 'src/product/entities/product.entity';
import { ProductStatus } from 'src/product/enums/product-status.enum';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderExpirySweep } from './order-expiry.sweep';

describe('OrderExpirySweep', () => {
  let updates: { target: unknown; status: string }[];
  let fail: boolean;
  let sweep: OrderExpirySweep;

  beforeEach(() => {
    updates = [];
    fail = false;

    const manager = {
      createQueryBuilder: () => {
        const update = { target: undefined as unknown, status: '' };
        const builder = {
          update: (target: unknown) => ((update.target = target), builder),
          set: ({ status }: { status: string }) => (
            (update.status = status),
            builder
          ),
          where: () => builder,
          andWhere: () => builder,
          execute: () => {
            if (fail) throw new Error('db down');
            updates.push(update);
            return { affected: 1 };
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

    sweep = new OrderExpirySweep(repo as never);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  it('expires pending orders, then puts their products back on sale', async () => {
    await sweep.sweep();

    expect(updates).toEqual([
      { target: Order, status: OrderStatus.EXPIRED },
      { target: Product, status: ProductStatus.ACTIVE },
    ]);
  });

  it('logs a failure instead of throwing', async () => {
    fail = true;
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(sweep.sweep()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
