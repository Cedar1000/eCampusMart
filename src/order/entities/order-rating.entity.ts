import { Column, Entity, Index, Unique } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';

export enum OrderRatingRole {
  BUYER = 'buyer',
  SELLER = 'seller',
}

export enum RateeType {
  USER = 'user',
  PRODUCT_STORE = 'product-store',
}

// One side's rating of the other after a completed order. The buyer rates the
// seller (the store, for a store order) and the seller rates the buyer; each
// side rates once
@Entity('order_rating')
@Unique(['orderId', 'raterId'])
export class OrderRating extends BaseEntity {
  @Index()
  @Column()
  orderId: string;

  @Column()
  raterId: string;

  @Column({ type: 'enum', enum: OrderRatingRole })
  raterRole: OrderRatingRole;

  // A user's id, or a product store's id, depending on rateeType
  @Column()
  rateeId: string;

  @Column({ type: 'enum', enum: RateeType })
  rateeType: RateeType;

  // 1 to 5
  @Column({ type: 'smallint' })
  stars: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;
}
