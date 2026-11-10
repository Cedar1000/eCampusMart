import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';

export enum PendingReviewStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

@Entity('pending_review')
export class PendingReview extends BaseEntity {
  @Column({
    type: 'enum',
    enum: PendingReviewStatus,
    default: PendingReviewStatus.PENDING,
  })
  status: PendingReviewStatus;

  // The completed order this review is for
  @Index()
  @Column({ nullable: true })
  orderId?: string;

  // What was ordered: a product for now; serviceId is there for service orders
  @Index()
  @Column({ type: 'varchar', nullable: true })
  productId?: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  serviceId?: string | null;

  @Index()
  @Column()
  buyerId: string;

  @Index()
  @Column()
  sellerId: string;

  @Index()
  @Column()
  receiverId: string;

  @Index()
  @Column()
  senderId: string;

  @Column({ default: false })
  senderIsStore: boolean;

  @Column({ default: false })
  receiverIsStore: boolean;
}
