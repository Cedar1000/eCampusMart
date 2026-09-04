import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';

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
}
