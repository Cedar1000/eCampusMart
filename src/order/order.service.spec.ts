import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { Product } from 'src/product/entities/product.entity';
import { ProductStatus } from 'src/product/enums/product-status.enum';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderService, pendingReviewsFor } from './order.service';
import { PendingReview } from 'src/review/entities/pending-review.entity';
import { uploadToCloudinary } from 'utils/cloudinary';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn((text: string) => `data:image/png;base64,${text}`),
}));
jest.mock('utils/cloudinary', () => ({ uploadToCloudinary: jest.fn() }));

const upload = uploadToCloudinary as jest.Mock;

type Values = Record<string, unknown>;

// Evaluates the few SQL fragments the order code uses, against an in-memory row
const evaluate = (
  expression: string,
  current: Values,
  params: Values,
): unknown => {
  const value = (term: string) =>
    term.startsWith(':') ? params[term.slice(1)] : current[term];

  const caseWhen = expression.match(
    /^CASE WHEN (\w+) = (:?\w+) THEN (:?\w+) ELSE (.+) END$/,
  );
  if (caseWhen) {
    const [, column, test, then, otherwise] = caseWhen;
    return String(value(column)) === String(value(test))
      ? evaluate(then, current, params)
      : evaluate(otherwise, current, params);
  }

  const sum = expression.match(/^(\w+) ([+-]) (:\w+)$/);
  if (sum) {
    const [, column, sign, term] = sum;
    const delta = Number(value(term));
    return Number(current[column]) + (sign === '+' ? delta : -delta);
  }

  return value(expression);
};

const matches = (where: string, current: Values, params: Values) =>
  where.split(' AND ').every((clause) => {
    const [column, operator, term] = clause.split(' ');
    if (column === 'id') return true;
    const left = Number(current[column]);
    const right = Number(/^\d+$/.test(term) ? term : params[term.slice(1)]);
    if (operator === '>=') return left >= right;
    if (operator === '>') return left > right;
    return (
      current[column] ===
      (/^\d+$/.test(term) ? Number(term) : params[term.slice(1)])
    );
  });

const fakeUpdate = (
  rows: () => { row: Values | null; product: Values | null },
) => {
  let target: unknown;
  let fields: Values = {};
  let where = '';
  let params: Values = {};
  const builder = {
    update: (entity: unknown) => ((target = entity), builder),
    set: (values: Values) => ((fields = values), builder),
    where: (clause: string, values: Values) => (
      (where = clause),
      (params = values),
      builder
    ),
    execute: () => {
      const current = target === Order ? rows().row : rows().product;
      if (!current || !matches(where, current, params)) return { affected: 0 };

      // Every SET expression reads the row as it was before the update
      const before = { ...current };
      for (const [key, set] of Object.entries(fields)) {
        current[key] =
          typeof set === 'function'
            ? evaluate((set as () => string)(), before, params)
            : set;
      }
      return { affected: 1 };
    },
  };
  return builder;
};

describe('OrderService', () => {
  let row: Partial<Order> | null;
  let product: Partial<Product> | null;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    manager: unknown;
  };
  let gateway: { notify: jest.Mock };
  let service: OrderService;

  const order = (quantity?: number) =>
    service.create({ productId: 'product-1', quantity }, 'buyer-1');

  beforeEach(() => {
    row = {
      id: 'order-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      productId: 'product-1',
      quantity: 1,
      status: OrderStatus.PENDING,
    };
    product = {
      id: 'product-1',
      userId: 'seller-1',
      storeId: 'store-1',
      isStoreProduct: false,
      price: '75000.50' as unknown as number,
      quantity: 3,
      status: ProductStatus.ACTIVE,
    };

    // Runs the service's conditional updates against `row` and `product`
    const manager = {
      findOne: jest.fn((entity: unknown) =>
        entity === Order ? row && { ...row } : product && { ...product },
      ),
      createQueryBuilder: () => fakeUpdate(() => ({ row, product })),
      insert: jest.fn(),
      getRepository: () => repo,
      transaction: jest.fn((run: (m: unknown) => unknown): unknown =>
        run(manager),
      ),
    };

    repo = {
      create: jest.fn((fields: object) => fields),
      save: jest.fn((fields: object) => ({ id: 'order-new', ...fields })),
      update: jest.fn(),
      find: jest.fn(() => [row]),
      count: jest.fn(() => 1),
      findOne: jest.fn(() => row),
      findOneBy: jest.fn(() => row),
      manager,
    };
    gateway = { notify: jest.fn() };
    service = new OrderService(repo as never, gateway as never);
    upload.mockReset().mockResolvedValue('https://res.cloudinary.com/qr.png');
  });

  it('saves a QR code of the order id after the order is created', async () => {
    const result = await order();

    expect(upload).toHaveBeenCalledWith(
      'data:image/png;base64,order-new',
      'orders',
      'order-new',
    );
    expect(repo.update).toHaveBeenCalledWith('order-new', {
      qrCode: 'https://res.cloudinary.com/qr.png',
    });
    expect(result.data).toMatchObject({
      qrCode: 'https://res.cloudinary.com/qr.png',
    });
  });

  it('still creates the order when the QR upload fails', async () => {
    upload.mockRejectedValue(new Error('cloudinary down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const result = await order();

    expect(result.data).toMatchObject({ id: 'order-new', amount: 75000.5 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('tells the seller and buyer the order was placed, with its QR code', async () => {
    await order();

    expect(gateway.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'order-new',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        qrCode: 'https://res.cloudinary.com/qr.png',
      }),
      'placed',
      'buyer-1',
    );
  });

  it('sends nothing when the order is refused', async () => {
    await expect(order(4)).rejects.toThrow(ConflictException);
    expect(gateway.notify).not.toHaveBeenCalled();
  });

  it('takes the seller and price from the product', async () => {
    const result = await order();

    expect(result.data).toMatchObject({
      productId: 'product-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      isStoreOrder: false,
      quantity: 1,
      amount: 75000.5,
    });
    // Saved in kobo, returned in naira
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 7500050 }),
    );
    expect(result.data).not.toHaveProperty('storeId', 'store-1');
  });

  describe('placing an order', () => {
    it('leaves the stock alone', async () => {
      const result = await order(3);

      expect(result.data).toMatchObject({ quantity: 3, amount: 225001.5 });
      expect(product).toMatchObject({
        quantity: 3,
        status: ProductStatus.ACTIVE,
      });
    });

    it('refuses more units than are in stock', async () => {
      await expect(order(4)).rejects.toThrow('Only 3 of this product left');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it.each([ProductStatus.OUT_OF_STOCK, ProductStatus.SOLD])(
      'refuses a product that is %s',
      async (status) => {
        product!.status = status;

        await expect(order()).rejects.toThrow(
          'This product is no longer available',
        );
        expect(repo.save).not.toHaveBeenCalled();
      },
    );
  });

  it('uses the amount of an accepted offer for one unit', async () => {
    const result = await service.create({ productId: 'product-1' }, 'buyer-1', {
      id: 'offer-1',
      amount: 500000,
    });

    expect(result.data).toMatchObject({
      offerId: 'offer-1',
      quantity: 1,
      amount: 5000,
    });
  });

  it('records the store for a store product', async () => {
    product!.isStoreProduct = true;

    const result = await order();

    expect(result.data).toMatchObject({
      isStoreOrder: true,
      storeId: 'store-1',
      sellerId: 'seller-1',
    });
  });

  it("refuses an order on the buyer's own product", async () => {
    product!.userId = 'buyer-1';

    await expect(order()).rejects.toThrow(BadRequestException);
  });

  it('refuses a product that no longer exists', async () => {
    product = null;

    await expect(order()).rejects.toThrow(NotFoundException);
  });

  it('lists orders through the query', async () => {
    const result = await service.findAll(
      { page: '1' } as never,
      'seller',
      'seller-1',
    );

    expect(result).toMatchObject({ status: 'success', count: 1, data: [row] });
  });

  it.each(['buyer-1', 'seller-1'])('lets %s update the order', async (user) => {
    const result = await service.update(
      'order-1',
      { status: OrderStatus.COMPLETED },
      user,
    );

    expect(result.data).toMatchObject({ status: OrderStatus.COMPLETED });
  });

  it('refuses anyone else', async () => {
    await expect(
      service.update('order-1', { status: OrderStatus.COMPLETED }, 'other'),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown order', async () => {
    row = null;

    await expect(service.update('nope', {}, 'buyer-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('deleting an expired order', () => {
    beforeEach(() => {
      row!.status = OrderStatus.EXPIRED;
    });

    it.each([
      ['seller-1', { hiddenBySeller: true }],
      ['buyer-1', { hiddenByBuyer: true }],
    ])('hides it from %s’s list only', async (user, hidden) => {
      await service.remove('order-1', user);

      expect(repo.update).toHaveBeenCalledWith('order-1', hidden);
    });

    it.each([
      OrderStatus.PENDING,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ])('refuses an order that is %s', async (status) => {
      row!.status = status;

      await expect(service.remove('order-1', 'seller-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('refuses someone else’s order', async () => {
      await expect(service.remove('order-1', 'someone')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('leaves the hidden orders out of that side’s list', async () => {
      await service.findAll({} as never, 'buyer', 'buyer-1');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            expect.objectContaining({
              buyerId: 'buyer-1',
              hiddenByBuyer: false,
            }),
          ] as object,
        }),
      );
    });
  });

  describe('cancel and complete', () => {
    // The pending order is for 2 of the product's 3 units
    beforeEach(() => {
      row!.quantity = 2;
    });

    it('cancelling leaves the stock alone', async () => {
      const result = await service.cancel('order-1', 'seller-1');

      expect(result.data).toMatchObject({ status: OrderStatus.CANCELLED });
      expect(row!.status).toBe(OrderStatus.CANCELLED);
      expect(product).toMatchObject({
        quantity: 3,
        status: ProductStatus.ACTIVE,
      });
      expect(gateway.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'order-1',
          status: OrderStatus.CANCELLED,
        }),
        'cancelled',
        'seller-1',
      );
    });

    it.each([
      ['buyer-1', 'buyer', 'buyer-1'],
      ['seller-1', 'seller', 'seller-1'],
    ])(
      'records that %s cancelled, and when',
      async (user, role, cancelledBy) => {
        const result = await service.cancel('order-1', user);

        expect(row).toMatchObject({
          cancelledBy,
          cancelledByRole: role,
          cancelledAt: expect.any(Date) as Date,
        });
        expect(result.data).toMatchObject({
          cancelledBy,
          cancelledByRole: role,
        });
      },
    );

    it("records a store order's cancellation by its owner as the store", async () => {
      Object.assign(row!, { isStoreOrder: true, storeId: 'store-1' });

      await service.cancel('order-1', 'seller-1');

      expect(row).toMatchObject({
        cancelledBy: 'store-1',
        cancelledByRole: 'seller',
      });
    });

    it('returns the closed order in naira', async () => {
      row!.amount = 7500050;

      const result = await service.cancel('order-1', 'buyer-1');

      expect(result.data.amount).toBe(75000.5);
      expect(gateway.notify).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 7500050 }),
        'cancelled',
        'buyer-1',
      );
    });

    it('creates a pending review for each side when completed', async () => {
      await service.complete('order-1', 'buyer-1');

      const { insert } = repo.manager as { insert: jest.Mock };
      expect(insert).toHaveBeenCalledWith(PendingReview, [
        {
          orderId: 'order-1',
          productId: 'product-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          senderId: 'buyer-1',
          senderIsStore: false,
          receiverId: 'seller-1',
          receiverIsStore: false,
        },
        {
          orderId: 'order-1',
          productId: 'product-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          senderId: 'seller-1',
          senderIsStore: false,
          receiverId: 'buyer-1',
          receiverIsStore: false,
        },
      ]);
    });

    it("puts the store on the seller's side of a store order's reviews", () => {
      const [buyerReview, sellerReview] = pendingReviewsFor({
        id: 'order-1',
        productId: 'product-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        isStoreOrder: true,
        storeId: 'store-1',
      });

      expect(buyerReview).toMatchObject({
        senderId: 'buyer-1',
        receiverId: 'store-1',
        receiverIsStore: true,
      });
      expect(sellerReview).toMatchObject({
        senderId: 'store-1',
        senderIsStore: true,
        receiverId: 'buyer-1',
      });
    });

    it('creates no pending reviews when cancelled', async () => {
      await service.cancel('order-1', 'buyer-1');

      expect(
        (repo.manager as { insert: jest.Mock }).insert,
      ).not.toHaveBeenCalled();
    });

    it('records when an order was completed', async () => {
      await service.complete('order-1', 'buyer-1');

      expect(row).toMatchObject({ completedAt: expect.any(Date) as Date });
      expect(row!.cancelledBy).toBeUndefined();
    });

    it('completing takes the units and keeps the rest on sale', async () => {
      const result = await service.complete('order-1', 'seller-1');

      expect(result.data).toMatchObject({ status: OrderStatus.COMPLETED });
      expect(product).toMatchObject({
        quantity: 1,
        status: ProductStatus.ACTIVE,
      });
      expect(gateway.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'order-1',
          status: OrderStatus.COMPLETED,
        }),
        'completed',
        'seller-1',
      );
    });

    it('completing the order for the last units marks the product out of stock', async () => {
      row!.quantity = 3;

      await service.complete('order-1', 'seller-1');

      expect(product).toMatchObject({
        quantity: 0,
        status: ProductStatus.OUT_OF_STOCK,
      });
    });

    it('refuses to complete when there are fewer units left than ordered', async () => {
      product!.quantity = 1;

      await expect(service.complete('order-1', 'seller-1')).rejects.toThrow(
        'Only 1 of this product left',
      );
      expect(product!.quantity).toBe(1);
      expect(gateway.notify).not.toHaveBeenCalled();
    });

    it('refuses to complete once the product is out of stock', async () => {
      Object.assign(product!, {
        quantity: 0,
        status: ProductStatus.OUT_OF_STOCK,
      });

      await expect(service.complete('order-1', 'seller-1')).rejects.toThrow(
        'This product is no longer available',
      );
    });

    it("doesn't let pending orders take more units than there are", async () => {
      await service.complete('order-1', 'seller-1');

      // Another pending order for 2 units, while only 1 is left
      row = { ...row!, id: 'order-2', status: OrderStatus.PENDING };

      await expect(service.complete('order-2', 'seller-1')).rejects.toThrow(
        'Only 1 of this product left',
      );
      expect(product!.quantity).toBe(1);
    });

    it('refuses an order that is no longer pending', async () => {
      row!.status = OrderStatus.COMPLETED;

      await expect(service.cancel('order-1', 'buyer-1')).rejects.toThrow(
        'This order is already completed',
      );
      expect(gateway.notify).not.toHaveBeenCalled();
    });

    it('lets only one of a cancel and a complete go through', async () => {
      const results = await Promise.allSettled([
        service.cancel('order-1', 'buyer-1'),
        service.complete('order-1', 'seller-1'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(product!.quantity).toBe(3);
    });

    it('refuses anyone but the buyer or seller', async () => {
      await expect(service.complete('order-1', 'other')).rejects.toThrow(
        ForbiddenException,
      );
      expect(product!.quantity).toBe(3);
    });

    it('returns 404 for an unknown order', async () => {
      row = null;

      await expect(service.cancel('nope', 'buyer-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
