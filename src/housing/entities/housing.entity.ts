import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity, OneToMany } from 'typeorm';

import { HouseType } from '../enums/house-type.enum';
import { HousingImage } from './housing-image.entity';

@Entity()
export class Housing extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'enum', enum: HouseType })
  houseType: HouseType;

  @Column()
  locationId: string;

  @Column()
  campusId: string;

  @Column({ nullable: true })
  whoCanRent: string;

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
}
