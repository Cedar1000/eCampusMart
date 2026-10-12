import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity } from 'typeorm';

@Entity()
export class HousingView extends BaseEntity {
  @Column()
  userId?: string;

  @Column()
  housingId?: string;
}
