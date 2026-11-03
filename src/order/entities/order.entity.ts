import { BeforeInsert, Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';

import { OrderStatus } from '../enums/order-status.enum';

@Entity('order')
export class Order extends BaseEntity {
  @Column()
  sellerId: string;

  @Column()
  buyerId: string;

  @Column()
  productId: string;

  @Column({ nullable: true })
  offerId: string;

  @Column({ default: false })
  isStoreOrder: boolean;

  @Column({ nullable: true })
  storeId: string;

  @Column({ nullable: true })
  qrCode: string;

  // In kobo, 1 kobo = 0.01 naira: the product's price when it was ordered
  @Column()
  amount: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @Column()
  expiresAt: Date;

  @BeforeInsert()
  setExpiration() {
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + 48); // offer expires in 48 hours
    this.expiresAt = expirationTime;
  }
}
export { OrderStatus };
