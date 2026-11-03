import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';

import { ProductStatus } from 'src/product/enums/product-status.enum';
import { ActiveProductGuard } from './active-product.guard';

const PRODUCT = '8fe7a3f2-4faa-4cd3-ad4c-25b7a15014fd';

describe('ActiveProductGuard', () => {
  const findOne = jest.fn();
  const guard = new ActiveProductGuard({ findOne } as never);

  const check = (body: unknown) =>
    guard.canActivate({
      switchToHttp: () => ({ getRequest: () => ({ body }) }),
    } as ExecutionContext);

  beforeEach(() => findOne.mockReset());

  it('lets an active product through', async () => {
    findOne.mockResolvedValue({ id: PRODUCT, status: ProductStatus.ACTIVE });

    await expect(check({ productId: PRODUCT })).resolves.toBe(true);
  });

  it.each([ProductStatus.ORDERED, ProductStatus.SOLD])(
    'refuses a product that is %s',
    async (status) => {
      findOne.mockResolvedValue({ id: PRODUCT, status });

      await expect(check({ productId: PRODUCT })).rejects.toThrow(
        'This product is no longer available',
      );
    },
  );

  it('refuses a product that does not exist', async () => {
    findOne.mockResolvedValue(null);

    await expect(check({ productId: PRODUCT })).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([undefined, {}, { productId: 'nope' }, { productId: 42 }])(
    'refuses a missing or invalid productId (%p) without querying',
    async (body) => {
      await expect(check(body)).rejects.toThrow(BadRequestException);
      expect(findOne).not.toHaveBeenCalled();
    },
  );
});
