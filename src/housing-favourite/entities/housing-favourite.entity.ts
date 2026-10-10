import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity, Unique } from 'typeorm';

@Entity()
@Unique(['userId', 'housingId'])
export class HousingFavourite extends BaseEntity {
  @Column()
  userId?: string;

  @Column()
  housingId?: string;
}
