import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ValidServiceStoreGuard } from './valid-service-store.guard';

describe('ValidServiceStoreGuard', () => {
  const repository = {
    findOne: jest.fn(),
  };
  const guard = new ValidServiceStoreGuard(repository as never);

  const contextFor = (storeId?: string, userId?: string) =>
    (() => {
      const request = {
        body: { storeId },
        res: { locals: { user: { id: userId } } },
      };

      return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      };
    })() as ExecutionContext;

  beforeEach(() => {
    repository.findOne.mockReset();
  });

  it('allows a store owned by the current user', async () => {
    repository.findOne.mockResolvedValue({
      id: 'store-id',
      ownerId: 'user-id',
      categoryId: 'category-id',
    });

    const context = contextFor('store-id', 'user-id');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().body.categoryId).toBe(
      'category-id',
    );
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'store-id' },
      select: ['id', 'ownerId', 'categoryId'],
    });
  });

  it('rejects a store that does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextFor('store-id', 'user-id')),
    ).rejects.toThrow(new NotFoundException('Service store not found'));
  });

  it('rejects a store owned by another user', async () => {
    repository.findOne.mockResolvedValue({
      id: 'store-id',
      ownerId: 'another-user-id',
    });

    await expect(
      guard.canActivate(contextFor('store-id', 'user-id')),
    ).rejects.toThrow(
      new ForbiddenException('You can only create a service in your own store'),
    );
  });
});
