import { Column, Entity, OneToMany } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';
import { BaseEntity } from 'src/common/base.entity';

@Entity()
export class ProductCategory extends BaseEntity {
  @Column()
  name: string;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
