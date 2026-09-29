import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';

import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { Service } from 'src/service/entities/service.entity';

@Entity()
export class ServiceStore extends BaseEntity {
  @Column()
  ownerId: string;

  @Column()
  categoryId: string;

  @Column({ nullable: true })
  campusId: string;

  @Column()
  name: string;

  @Column({ default: 0 })
  ratingsCount: number;

  @Column({ default: 0 })
  servicesCount: number;

  @Column({ default: 15000 })
  basePrice: number;

  @Column({ default: 0 })
  completedBookings: number;

  @Column({ nullable: true, type: 'float', default: 0 })
  ratingsAverage: number;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  logoKey: string;

  @Column({ nullable: true })
  banner: string;

  @Column({ nullable: true })
  bannerKey: string;

  @OneToMany(() => ServiceCategory, (category) => category.store)
  categories: ServiceCategory[];

  @OneToMany(() => Service, (service) => service.store)
  services: Service[];
}
