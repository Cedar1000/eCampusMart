import { Column, Entity, ManyToOne } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';

@Entity()
export class ServiceCategory extends BaseEntity {
  @Column()
  name: string;

  @ManyToOne(() => ServiceStore, (store) => store.categories)
  store: ServiceStore;

  @ManyToOne(() => ServiceStore, (store) => store.categories)
  services: ServiceStore;
}
