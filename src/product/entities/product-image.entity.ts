import { Column, Entity, ManyToOne } from 'typeorm';

import { Product } from './product.entity';
import { BaseEntity } from 'src/common/base.entity';

@Entity()
export class ProductImage extends BaseEntity {
  @Column()
  url: string;

  @Column()
  key: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  product: Product;
}
