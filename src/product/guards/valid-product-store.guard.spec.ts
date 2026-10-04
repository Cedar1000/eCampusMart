import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ValidProductStoreGuard } from './valid-product-store.guard';

describe('ValidProductStoreGuard', () => {
  const repository = {
    findOne: jest.fn(),
  };
  const guard = new ValidProductStoreGuard(repository as never);

  const contextFor = (storeId?: string, userId?: string) => {
    const request = {
      body: { storeId },
      res: { locals: { user: { id: userId } } },
    };

    return {
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as ExecutionContext,
      request,
    };
  };

  beforeEach(() => {
    repository.findOne.mockReset();
  });

  it('validates ownership and attaches the store category', async () => {
    repository.findOne.mockResolvedValue({
      id: 'store-id',
      userId: 'user-id',
      categoryId: 'category-id',
    });
    const { context, request } = contextFor('store-id', 'user-id');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.body.categoryId).toBe('category-id');
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'store-id' },
      select: ['id', 'userId', 'categoryId'],
    });
  });

  it('rejects a missing store', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor('store-id', 'user-id').context)).rejects.toThrow(
      new NotFoundException('Product store not found'),
    );
  });

  it('requires a store ID', async () => {
    await expect(guard.canActivate(contextFor(undefined, 'user-id').context)).rejects.toThrow(
      new BadRequestException(
        'storeId is required when creating a store product',
      ),
    );
  });

  it('rejects a store owned by another user', async () => {
    repository.findOne.mockResolvedValue({
      id: 'store-id',
      userId: 'another-user-id',
      categoryId: 'category-id',
    });

    await expect(guard.canActivate(contextFor('store-id', 'user-id').context)).rejects.toThrow(
      new ForbiddenException('You can only create products in your own store'),
    );
  });

  it('rejects a store without a category', async () => {
    repository.findOne.mockResolvedValue({
      id: 'store-id',
      userId: 'user-id',
      categoryId: null,
    });

    await expect(guard.canActivate(contextFor('store-id', 'user-id').context)).rejects.toThrow(
      new BadRequestException('Product store has no category'),
    );
  });
});
