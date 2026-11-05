import { EntityManager } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';
import { ProductStatus } from 'src/product/enums/product-status.enum';

// Orders placed before stock was tracked held the whole product as `ordered`
// without taking any units, so those products get no units back

// Returns a cancelled or expired order's units to the product, which puts it
// back on sale
export const restock = (
  manager: EntityManager,
  productId: string,
  quantity: number,
) =>
  manager
    .createQueryBuilder()
    .update(Product)
    .set({
      quantity: () =>
        'CASE WHEN status = :ordered THEN quantity ELSE quantity + :quantity END',
      status: ProductStatus.ACTIVE,
    })
    .where('id = :productId', {
      productId,
      quantity,
      ordered: ProductStatus.ORDERED,
    })
    .execute();

// A completed order sells the product once its last units are gone
export const markSold = async (
  manager: EntityManager,
  productId: string,
  quantity: number,
) => {
  await manager
    .createQueryBuilder()
    .update(Product)
    .set({ status: ProductStatus.SOLD })
    .where('id = :productId AND status = :outOfStock AND quantity = 0', {
      productId,
      outOfStock: ProductStatus.OUT_OF_STOCK,
    })
    .execute();

  // An order from before stock was tracked takes its units now: the product goes
  // back on sale if any are left, else it's sold
  await manager
    .createQueryBuilder()
    .update(Product)
    .set({
      quantity: () => 'quantity - :quantity',
      status: ProductStatus.ACTIVE,
    })
    .where('id = :productId AND status = :ordered AND quantity > :quantity', {
      productId,
      quantity,
      ordered: ProductStatus.ORDERED,
    })
    .execute();

  await manager
    .createQueryBuilder()
    .update(Product)
    .set({ quantity: 0, status: ProductStatus.SOLD })
    .where('id = :productId AND status = :ordered', {
      productId,
      ordered: ProductStatus.ORDERED,
    })
    .execute();
};
