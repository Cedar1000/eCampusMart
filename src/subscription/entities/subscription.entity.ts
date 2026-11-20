import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity } from 'typeorm';
import {
  SubscriptionRefundStatus,
  SubscriptionStatus,
} from '../enums/subscription-status.enum';

@Entity()
export class Subscription extends BaseEntity {
  @Column()
  userId: string;

  @Column()
  planId: string;

  @Column()
  storeId: string;

  @Column()
  paystackId: string;

  @Column()
  reference: string;

  @Column({ nullable: true })
  subscriptionCode?: string;

  @Column({ nullable: true })
  emailToken?: string;

  @Column()
  amount: number;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING,
  })
  status: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionRefundStatus,
    nullable: true,
  })
  refundStatus?: SubscriptionRefundStatus | null;

  // Free first period: Paystack only starts charging when it ends
  @Column({ default: false })
  isTrial: boolean;

  @Column()
  expiresAt: Date;
}
