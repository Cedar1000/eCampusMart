import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';
import { ProductStatus } from 'src/product/enums/product-status.enum';

// Takes a completed order's units from the product, marking it out of stock when
// none are left. Conditional, so orders completed at once can't take more units
// than there are; when there aren't enough, the completion is refused
export const takeStock = async (
  manager: EntityManager,
  productId: string,
  quantity: number,
) => {
  const taken = await manager
    .createQueryBuilder()
    .update(Product)
    .set({
      quantity: () => 'quantity - :quantity',
      status: () =>
        'CASE WHEN quantity = :quantity THEN :outOfStock ELSE status END',
    })
    .where('id = :productId AND status = :active AND quantity >= :quantity', {
      productId,
      quantity,
      active: ProductStatus.ACTIVE,
      outOfStock: ProductStatus.OUT_OF_STOCK,
    })
    .execute();

  if (taken.affected) return;

  const product = await manager.findOne(Product, {
    where: { id: productId },
    select: ['id', 'quantity', 'status'],
  });

  throw new ConflictException(
    product?.status === ProductStatus.ACTIVE
      ? `Only ${product.quantity} of this product left`
      : 'This product is no longer available',
  );
};
