import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity } from 'typeorm';

@Entity()
export class ServiceView extends BaseEntity {
  @Column()
  userId?: string;

  @Column()
  serviceId?: string;
}
