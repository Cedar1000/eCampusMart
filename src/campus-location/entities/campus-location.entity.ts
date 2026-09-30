import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';

import { Campus } from 'src/campus/entities/campus.entity';

@Entity()
export class CampusLocation extends BaseEntity {
  @Column()
  name: string;

  @Column()
  campusId: string;

  @ManyToOne(() => Campus, (campus) => campus.locations)
  campus: Campus;
}
