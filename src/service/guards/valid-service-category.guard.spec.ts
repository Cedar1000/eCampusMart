import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ValidServiceCategoryGuard } from './valid-service-category.guard';

describe('ValidServiceCategoryGuard', () => {
  const repository = {
    findOne: jest.fn(),
  };
  const guard = new ValidServiceCategoryGuard(repository as never);

  const contextFor = (
    categoryId?: string,
    storeId?: string,
    userId?: string,
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          body: { categoryId, storeId },
          res: { locals: { user: { id: userId } } },
        }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    repository.findOne.mockReset();
  });

  it('allows a category belonging to the current user store', async () => {
    repository.findOne.mockResolvedValue({
      id: 'category-id',
      store: { id: 'store-id', ownerId: 'user-id' },
    });

    await expect(
      guard.canActivate(contextFor('category-id', 'store-id', 'user-id')),
    ).resolves.toBe(true);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'category-id' },
      relations: { store: true },
    });
  });

  it('rejects a category that does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextFor('category-id', 'store-id', 'user-id')),
    ).rejects.toThrow(new NotFoundException('Service category not found'));
  });

  it('rejects a category from another store', async () => {
    repository.findOne.mockResolvedValue({
      id: 'category-id',
      store: { id: 'another-store-id', ownerId: 'user-id' },
    });

    await expect(
      guard.canActivate(contextFor('category-id', 'store-id', 'user-id')),
    ).rejects.toThrow(
      new ForbiddenException(
        'Service category does not belong to the selected store',
      ),
    );
  });

  it('rejects a category from another user store', async () => {
    repository.findOne.mockResolvedValue({
      id: 'category-id',
      store: { id: 'store-id', ownerId: 'another-user-id' },
    });

    await expect(
      guard.canActivate(contextFor('category-id', 'store-id', 'user-id')),
    ).rejects.toThrow(
      new ForbiddenException('You can only use categories from your own store'),
    );
  });
});
