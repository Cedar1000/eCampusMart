import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';
import { Service } from 'src/service/entities/service.entity';

@Entity()
export class ServiceCategory extends BaseEntity {
  @Column()
  name: string;

  @OneToMany(() => Service, (service) => service.category)
  services: Service[];
}
