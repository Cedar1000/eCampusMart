import { BaseEntity } from 'src/common/base.entity';
import { BeforeInsert, Column, Entity, OneToMany } from 'typeorm';

import { HouseType } from '../enums/house-type.enum';
import { HousingImage } from './housing-image.entity';
import { randomInt } from 'crypto';

@Entity()
export class Housing extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'enum', enum: HouseType })
  houseType: HouseType;

  @Column()
  locationId: string;

  @Column()
  listingId: string;

  @Column()
  campusId: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  whoCanRent: string;

  @Column({ default: 0 })
  favoriteCount: number;

  @Column()
  description: string;

  @Column({ type: 'boolean', default: false })
  isNegotiable: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column()
  pricePeriod: string;

  @OneToMany(() => HousingImage, (image) => image.housing)
  images: HousingImage[];

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
