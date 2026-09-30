import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { CampusLocation } from 'src/campus-location/entities/campus-location.entity';

@Entity('campuses')
export class Campus extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  abbreviation: string;

  @Column()
  type: string;

  @Column()
  state: string;

  @Column({ nullable: true })
  logo: string;

  @OneToMany(() => CampusLocation, (location) => location.campus)
  locations: CampusLocation[];
}
