import { BeforeInsert, Column, Entity, ManyToOne, OneToMany } from 'typeorm';

import { randomInt } from 'crypto';

import { BaseEntity } from 'src/common/base.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { ServiceImage } from './service-image.entity';
import { PriceUnit } from '../enums/price.enum';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';

@Entity()
export class Service extends BaseEntity {
  @Column()
  title: string;

  @Column()
  ownerId: string;

  @Column()
  categoryId: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isNegotiable: boolean;

  @Column()
  campusId: string;

  @Column()
  storeId: string;

  @Column()
  listingId: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  price: number;

  @Column({ type: 'enum', enum: PriceUnit })
  priceUnit: PriceUnit;

  @ManyToOne(() => ServiceCategory, (category) => category.services)
  category: ServiceCategory;

  @ManyToOne(() => ServiceStore, (store) => store.services, {
    onDelete: 'CASCADE',
  })
  store: ServiceStore;

  @OneToMany(() => ServiceImage, (image) => image.service)
  images: ServiceImage[];

  @BeforeInsert()
  generateSlug() {
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
