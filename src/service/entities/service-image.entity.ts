import { Column, Entity, ManyToOne } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';
import { Service } from './service.entity';

@Entity()
export class ServiceImage extends BaseEntity {
  @Column()
  url: string;

  @Column()
  key: string;

  @Column()
  serviceId: string;

  @ManyToOne(() => Service, (service) => service.images, {
    onDelete: 'CASCADE',
  })
  service: Service;
}
