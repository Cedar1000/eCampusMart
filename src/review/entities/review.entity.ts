import { BeforeInsert, Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';

// What senderId and receiverId point at
export enum ReviewPartyType {
  USER = 'user',
  PRODUCT_STORE = 'product-store',
  SERVICE_STORE = 'service-store',
}

@Entity('review')
// One review per user per service store
@Index('UQ_review_service_store_sender', ['senderId', 'receiverId'], {
  unique: true,
  where: `"receiverType" = 'service-store'`,
})
export class Review extends BaseEntity {
  @Index()
  @Column()
  buyerId: string;

  @Index()
  @Column()
  sellerId: string;

  @Column({ type: 'text', nullable: true })
  body?: string;

  @Column({ type: 'float' })
  rating: number;

  // Null on a service store review: those come from a chat, not an order
  @Index()
  @Column({ type: 'varchar', nullable: true })
  pendingReviewId: string | null;

  // The order reviewed, and its product; null on a service store review
  @Index()
  @Column({ type: 'varchar', nullable: true })
  orderId?: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  productId?: string | null;

  // The service reviewed, when a service store review names one
  @Index()
  @Column({ type: 'varchar', nullable: true })
  serviceId?: string | null;

  @Column({ default: false })
  hasBody: boolean;

  @Column({ default: false })
  senderIsStore: boolean;

  @Column({ default: false })
  receiverIsStore: boolean;

  @Index()
  @Column()
  receiverId: string;

  @Index()
  @Column()
  senderId: string;

  @Column({
    type: 'enum',
    enum: ReviewPartyType,
    default: ReviewPartyType.USER,
  })
  senderType: ReviewPartyType;

  @Column({
    type: 'enum',
    enum: ReviewPartyType,
    default: ReviewPartyType.USER,
  })
  receiverType: ReviewPartyType;

  @BeforeInsert()
  setHasBody() {
    if (this.body && this.body.trim() !== '') {
      this.hasBody = true;
    }
  }
}
