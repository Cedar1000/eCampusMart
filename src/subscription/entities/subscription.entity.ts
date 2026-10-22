import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity } from 'typeorm';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

// The card Paystack can charge for the subscription, from the trial's card check
export interface SubscriptionAuthorization {
  authorizationCode: string;
  customerCode: string;
  last4: string;
  expMonth: string;
  expYear: string;
  cardType: string;
  bank: string;
  signature: string;
  reusable: boolean;
}

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

  // Free first period: Paystack only starts charging when it ends
  @Column({ default: false })
  isTrial: boolean;

  @Column()
  expiresAt: Date;

  // Never returned: select it explicitly where it's needed
  @Column({ type: 'jsonb', nullable: true, select: false })
  authorization?: SubscriptionAuthorization | null;
}
