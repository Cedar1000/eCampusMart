import { Column, Entity, ManyToOne } from 'typeorm';

import { Housing } from './housing.entity';
import { BaseEntity } from 'src/common/base.entity';

@Entity()
export class HousingImage extends BaseEntity {
  @Column()
  url: string;

  @Column()
  key: string;

  @Column()
  housingId: string;

  @ManyToOne(() => Housing, (housing) => housing.images, {
    onDelete: 'CASCADE',
  })
  housing: Housing;
}
