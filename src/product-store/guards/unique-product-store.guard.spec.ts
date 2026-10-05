import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UniqueProductStoreGuard } from './unique-product-store.guard';

describe('UniqueProductStoreGuard', () => {
  const repository = {
    findOne: jest.fn(),
  };
  const guard = new UniqueProductStoreGuard(repository as never);

  const contextFor = (userId?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          res: { locals: { user: userId ? { id: userId } : undefined } },
        }),
      }),
    }) as ExecutionContext;

  beforeEach(() => repository.findOne.mockReset());

  it('allows a user without a product store', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor('user-id'))).resolves.toBe(true);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      select: ['id'],
    });
  });

  it('rejects a user who already has a product store', async () => {
    repository.findOne.mockResolvedValue({ id: 'store-id' });

    await expect(guard.canActivate(contextFor('user-id'))).rejects.toThrow(
      new ConflictException('You already have a product store'),
    );
  });

  it('rejects an unauthenticated request', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toThrow(
      new UnauthorizedException('Authenticated user not found'),
    );
  });
});
