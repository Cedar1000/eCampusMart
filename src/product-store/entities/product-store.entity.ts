import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';

import { ProductStoreCategory } from 'src/product-store-category/entities/product-store-category.entity';

@Entity()
export class ProductStore extends BaseEntity {
  @Column()
  userId: string;

  @Column({ nullable: true })
  categoryId: string;

  @Column()
  name: string;

  @Column({ default: 0 })
  ratingsCount: number;

  @Column({ nullable: true, type: 'float', default: 0 })
  ratingsAverage: number;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  coverImage: string;

  @OneToMany(() => ProductStoreCategory, (category) => category.store)
  categories: ProductStoreCategory[];
}
