import { BeforeInsert, Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { randomInt } from 'crypto';

import slugify from 'slugify';

import { BaseEntity } from 'src/common/base.entity';
import { ProductImage } from './product-image.entity';
import { ProductStatus } from '../enums/product-status.enum';
import { ProductCondition } from '../enums/product-condition.enum';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';

import { ProductStoreCategory } from 'src/product-store-category/entities/product-store-category.entity';

@Entity()
export class Product extends BaseEntity {
  @Column()
  name: string;

  @Column()
  userId: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  campusId: string;

  @Column()
  price: number;

  @Column({ default: 1 })
  quantity: number;

  @Column()
  slug: string;

  @Column({ default: false })
  isStoreProduct: boolean;

  @Column({ nullable: true })
  storeCategoryId: string;

  @Column({ nullable: true })
  categoryId: string;

  @Column({ nullable: true })
  storeId: string;

  @Column()
  listingId: string;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status: ProductStatus;

  @Column({
    type: 'enum',
    enum: ProductCondition,
    default: ProductCondition.BRAND_NEW,
    nullable: true,
  })
  condition: ProductCondition;

  @ManyToOne(() => ProductCategory, (category) => category.products)
  category: ProductCategory;

  @ManyToOne(() => ProductStoreCategory, (category) => category.products)
  storeCategory: ProductStoreCategory;

  @OneToMany(() => ProductImage, (image) => image.product)
  images: ProductImage[];

  @BeforeInsert()
  generateSlug() {
    this.slug = slugify(this.name, { lower: true });
    this.listingId = `LST-${this.generateListingSegment(4)}-${this.generateListingSegment(2)}`;
  }

  private generateListingSegment(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    return Array.from(
      { length },
      () => characters[randomInt(characters.length)],
    ).join('');
  }
}
