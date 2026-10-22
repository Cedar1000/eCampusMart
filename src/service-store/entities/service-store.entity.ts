import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';

import { Service } from 'src/service/entities/service.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';

export type FreePlanReminder = '3d' | '1d' | 'ended';

type ServiceAvailabilityDay = {
  active: boolean;
  openingTime: string | null;
  closingTime: string | null;
};

export type ServiceAvailability = {
  monday: ServiceAvailabilityDay;
  tuesday: ServiceAvailabilityDay;
  wednesday: ServiceAvailabilityDay;
  thursday: ServiceAvailabilityDay;
  friday: ServiceAvailabilityDay;
  saturday: ServiceAvailabilityDay;
  sunday: ServiceAvailabilityDay;
};

const DEFAULT_SERVICE_AVAILABILITY: ServiceAvailability = {
  monday: { active: false, openingTime: null, closingTime: null },
  tuesday: { active: false, openingTime: null, closingTime: null },
  wednesday: { active: false, openingTime: null, closingTime: null },
  thursday: { active: false, openingTime: null, closingTime: null },
  friday: { active: false, openingTime: null, closingTime: null },
  saturday: { active: false, openingTime: null, closingTime: null },
  sunday: { active: false, openingTime: null, closingTime: null },
};
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
  unreadMessages: number;

  @Column({ default: false })
  isOnline: boolean;

  // On Explore: during the free month or while a paid plan runs (see store-visibility.ts)
  @Column({ default: false })
  hasActiveSubscription: boolean;

  @Column({ default: true })
  hasFreeTrial: boolean;

  // End of the free month; stores opened before it was saved fall back to createdAt + 30 days
  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt?: Date | null;

  // The seller cancelled the free month; they can restart it until trialEndsAt
  @Column({ default: false })
  trialCancelled: boolean;

  // Last free-plan expiry reminder emailed (FreePlanReminderSweep), so none repeats
  @Column({ type: 'varchar', nullable: true })
  trialReminderSent?: FreePlanReminder | null;

  @Column({ default: 0 })
  servicesCount: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  basePrice: number;

  @Column({ default: 0 })
  completedBookings: number;

  @Column({ nullable: true, type: 'float', default: 0 })
  ratingsAverage: number;

  @Column({ nullable: true })
  address?: string;

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

  @Column({ type: 'json', default: DEFAULT_SERVICE_AVAILABILITY })
  availability: ServiceAvailability;

  @OneToMany(() => ServiceCategory, (category) => category.store)
  categories: ServiceCategory[];

  @OneToMany(() => Service, (service) => service.store)
  services: Service[];
}
