import { NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ValidProductCategoryGuard } from './valid-product-category.guard';

describe('ValidProductCategoryGuard', () => {
  const repository = {
    findOne: jest.fn(),
  };
  const guard = new ValidProductCategoryGuard(repository as never);

  const contextFor = (categoryId?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ body: { categoryId } }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    repository.findOne.mockReset();
  });

  it('allows an existing product category', async () => {
    repository.findOne.mockResolvedValue({ id: 'category-id' });

    await expect(guard.canActivate(contextFor('category-id'))).resolves.toBe(
      true,
    );
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'category-id' },
      select: ['id'],
    });
  });

  it('rejects a missing product category', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor('category-id'))).rejects.toThrow(
      new NotFoundException('Product category not found'),
    );
  });
});
