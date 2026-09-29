import { NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ValidServiceCategoryGuard } from './valid-service-category.guard';

describe('ValidServiceCategoryGuard', () => {
  const repository = {
    findOne: jest.fn(),
  };
  const guard = new ValidServiceCategoryGuard(repository as never);

  const contextFor = (categoryId?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ body: { categoryId } }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    repository.findOne.mockReset();
  });

  it('allows a category that exists', async () => {
    repository.findOne.mockResolvedValue({ id: 'category-id' });

    await expect(guard.canActivate(contextFor('category-id'))).resolves.toBe(
      true,
    );
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'category-id' },
      select: ['id'],
    });
  });

  it('rejects a category that does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor('category-id'))).rejects.toThrow(
      new NotFoundException('Service category not found'),
    );
  });
});
