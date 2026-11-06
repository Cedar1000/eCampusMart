import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';

export enum NotificationType {
  OFFER_RECEIVED = 'offer-received',
  OFFER_ACCEPTED = 'offer-accepted',
  ORDER_COMPLETED = 'order-completed',
  ORDER_CANCELLED = 'order-cancelled',
  REVIEW_PENDING = 'review-pending',
  REVIEW_RECEIVED = 'review-received',
  WALLET_FUNDED = 'wallet-funded',
  WALLET_DEBITED = 'wallet-debited',
  WALLET_REFUNDED = 'wallet-refunded',
}

// What the app needs to open the notification's screen, e.g. { orderId } or
// { offerId, productId }. Amounts are in naira
export type NotificationData = Record<string, string | number | null>;

// A notification in the user's in-app list, e.g. "Offer accepted:
// ₦6,000 · Oraimo 20W fast charger · order ORD-2113 created"
@Entity('notification')
export class Notification extends BaseEntity {
  @Index()
  @Column()
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data: NotificationData | null;

  @Column({ default: false })
  read: boolean;
}
