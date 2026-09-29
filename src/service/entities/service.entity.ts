import { BeforeInsert, Column, Entity, ManyToOne, OneToMany } from 'typeorm';

import { randomInt } from 'crypto';

import { BaseEntity } from 'src/common/base.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { ServiceImage } from './service-image.entity';
import { PriceUnit } from '../enums/price.enum';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';

type ServiceAvailabilityDay = {
  active: boolean;
  openingTime: string | null;
  closingTime: string | null;
};

export type ServiceAvailability = {
  monday: ServiceAvailabilityDay;
  tuesday: ServiceAvailabilityDay;
  wednesday: ServiceAvailabilityDay;
  thursday: ServiceAvailabilityDay;
  friday: ServiceAvailabilityDay;
  saturday: ServiceAvailabilityDay;
  sunday: ServiceAvailabilityDay;
};

const DEFAULT_SERVICE_AVAILABILITY: ServiceAvailability = {
  monday: { active: false, openingTime: null, closingTime: null },
  tuesday: { active: false, openingTime: null, closingTime: null },
  wednesday: { active: false, openingTime: null, closingTime: null },
  thursday: { active: false, openingTime: null, closingTime: null },
  friday: { active: false, openingTime: null, closingTime: null },
  saturday: { active: false, openingTime: null, closingTime: null },
  sunday: { active: false, openingTime: null, closingTime: null },
};

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

  @Column({ type: 'float' })
  price: number;

  @Column({ type: 'enum', enum: PriceUnit })
  priceUnit: PriceUnit;

  @Column({ type: 'json', default: DEFAULT_SERVICE_AVAILABILITY })
  availability: ServiceAvailability;

  @ManyToOne(() => ServiceCategory, (category) => category.services)
  category: ServiceCategory;

  @ManyToOne(() => ServiceStore, (store) => store.services)
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
