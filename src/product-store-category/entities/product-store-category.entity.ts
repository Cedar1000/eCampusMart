import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';
import { BaseEntity } from 'src/common/base.entity';

import { ProductStore } from 'src/product-store/entities/product-store.entity';

@Entity()
export class ProductStoreCategory extends BaseEntity {
  @Column()
  name: string;

  @Column()
  storeId: string;

  @ManyToOne(() => ProductStore, (store) => store.categories)
  store: ProductStore;

  @OneToMany(() => Product, (product) => product.storeCategory)
  products: Product[];
}
