import { BeforeInsert, Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';

export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  // when the offer is accepted by another user
  EXPIRED_BY_ACCEPTANCE = 'expired-by-acceptance',
}

export enum OfferSellerType {
  USER = 'user',
  PRODUCT_STORE = 'product-store',
  SERVICE_STORE = 'service-store',
}

@Entity('offer')
export class Offer extends BaseEntity {
  // A user's id, or a product or service store's id, depending on sellerType
  @Column()
  sellerId: string;

  @Column({
    type: 'enum',
    enum: OfferSellerType,
    default: OfferSellerType.USER,
  })
  sellerType: OfferSellerType;

  @Column()
  buyerId: string;

  @Column()
  productId: string;

  //in kobo, 1 kobo = 0.01 naira
  @Column()
  amount: number;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.PENDING })
  status: OfferStatus;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @Column()
  expiresAt: Date;

  @BeforeInsert()
  setExpiration() {
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + 24); // offer expires in 24 hours
    this.expiresAt = expirationTime;
  }
}
