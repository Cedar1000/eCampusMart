import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity } from 'typeorm';

import { PlanType } from '../enums/plan-type.enum';

@Entity()
export class SubscriptionPlan extends BaseEntity {
  @Column()
  name: string;

  @Column()
  paystackId: string;

  @Column()
  amount: number;

  @Column({ type: 'enum', enum: PlanType })
  type: PlanType;
}
