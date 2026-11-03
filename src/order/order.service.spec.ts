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
import { OrderService } from './order.service';
import { uploadToCloudinary } from 'utils/cloudinary';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn((text: string) => `data:image/png;base64,${text}`),
}));
jest.mock('utils/cloudinary', () => ({ uploadToCloudinary: jest.fn() }));

const upload = uploadToCloudinary as jest.Mock;

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
  let service: OrderService;

  const order = () => service.create({ productId: 'product-1' }, 'buyer-1');

  beforeEach(() => {
    row = {
      id: 'order-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      productId: 'product-1',
      status: OrderStatus.PENDING,
    };
    product = {
      id: 'product-1',
      userId: 'seller-1',
      storeId: 'store-1',
      isStoreProduct: false,
      price: '75000.50' as unknown as number,
      status: ProductStatus.ACTIVE,
    };

    // Each conditional update only applies while the row has the expected status
    const manager = {
      findOne: jest.fn((entity: unknown) =>
        entity === Order ? row && { ...row } : product,
      ),
      createQueryBuilder: () => {
        let target: unknown;
        let fields: { status: string };
        let params: Record<string, string>;
        const builder = {
          update: (entity: unknown) => ((target = entity), builder),
          set: (values: typeof fields) => ((fields = values), builder),
          where: (_: string, values: typeof params) => (
            (params = values),
            builder
          ),
          execute: () => {
            const current = target === Order ? row : product;
            const expected = params.active ?? params.pending ?? params.ordered;
            if (!current || String(current.status) !== expected)
              return { affected: 0 };
            Object.assign(current, fields);
            return { affected: 1 };
          },
        };
        return builder;
      },
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
    service = new OrderService(repo as never);
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

    expect(result.data).toMatchObject({ id: 'order-new', amount: 7500050 });
    expect(repo.update).not.toHaveBeenCalled();
    expect(product!.status).toBe(ProductStatus.ORDERED);
  });

  it('takes the seller and amount from the product and marks it ordered', async () => {
    const result = await order();

    expect(result.data).toMatchObject({
      productId: 'product-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      isStoreOrder: false,
      amount: 7500050,
    });
    expect(result.data).not.toHaveProperty('storeId', 'store-1');
    expect(product!.status).toBe(ProductStatus.ORDERED);
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

  it('lets only one of two buyers order the product', async () => {
    const results = await Promise.allSettled([order(), order()]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')?.reason).toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it("refuses an order on the buyer's own product", async () => {
    product!.userId = 'buyer-1';

    await expect(order()).rejects.toThrow(BadRequestException);
    expect(product!.status).toBe(ProductStatus.ACTIVE);
  });

  it('refuses a product that no longer exists', async () => {
    product = null;

    await expect(order()).rejects.toThrow(NotFoundException);
  });

  it('lists orders through the query', async () => {
    const result = await service.findAll({ page: '1' } as never);

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

  describe('cancel and complete', () => {
    beforeEach(() => {
      product!.status = ProductStatus.ORDERED;
    });

    it('cancelling puts the product back on sale', async () => {
      const result = await service.cancel('order-1', 'buyer-1');

      expect(result.data).toMatchObject({ status: OrderStatus.CANCELLED });
      expect(row!.status).toBe(OrderStatus.CANCELLED);
      expect(product!.status).toBe(ProductStatus.ACTIVE);
    });

    it('completing marks the product sold', async () => {
      const result = await service.complete('order-1', 'seller-1');

      expect(result.data).toMatchObject({ status: OrderStatus.COMPLETED });
      expect(product!.status).toBe(ProductStatus.SOLD);
    });

    it('refuses an order that is no longer pending', async () => {
      row!.status = OrderStatus.COMPLETED;
      product!.status = ProductStatus.SOLD;

      await expect(service.cancel('order-1', 'buyer-1')).rejects.toThrow(
        'This order is already completed',
      );
      expect(product!.status).toBe(ProductStatus.SOLD);
    });

    it('lets only one of a cancel and a complete go through', async () => {
      const results = await Promise.allSettled([
        service.cancel('order-1', 'buyer-1'),
        service.complete('order-1', 'seller-1'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(product!.status).toBe(ProductStatus.ACTIVE);
    });

    it('refuses anyone but the buyer or seller', async () => {
      await expect(service.complete('order-1', 'other')).rejects.toThrow(
        ForbiddenException,
      );
      expect(product!.status).toBe(ProductStatus.ORDERED);
    });

    it('returns 404 for an unknown order', async () => {
      row = null;

      await expect(service.cancel('nope', 'buyer-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
