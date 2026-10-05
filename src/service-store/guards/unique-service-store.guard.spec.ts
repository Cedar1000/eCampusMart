import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UniqueServiceStoreGuard } from './unique-service-store.guard';

describe('UniqueServiceStoreGuard', () => {
  const repository = {
    findOne: jest.fn(),
  };
  const guard = new UniqueServiceStoreGuard(repository as never);

  const contextFor = (userId?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          res: { locals: { user: userId ? { id: userId } : undefined } },
        }),
      }),
    }) as ExecutionContext;

  beforeEach(() => repository.findOne.mockReset());

  it('allows a user without a service store', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor('user-id'))).resolves.toBe(true);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { ownerId: 'user-id' },
      select: ['id'],
    });
  });

  it('rejects a user who already has a service store', async () => {
    repository.findOne.mockResolvedValue({ id: 'store-id' });

    await expect(guard.canActivate(contextFor('user-id'))).rejects.toThrow(
      new ConflictException('You already have a service store'),
    );
  });

  it('rejects an unauthenticated request', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toThrow(
      new UnauthorizedException('Authenticated user not found'),
    );
  });
});
