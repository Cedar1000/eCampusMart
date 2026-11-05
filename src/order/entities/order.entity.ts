import { BeforeInsert, Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';

import { OrderStatus } from '../enums/order-status.enum';
import { randomInt } from 'crypto';

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

  @Column({ nullable: true })
  orderId: string;

  @Column({ default: false })
  isStoreOrder: boolean;

  @Column({ nullable: true })
  storeId: string;

  @Column({ nullable: true })
  qrCode: string;

  // How many units were ordered; taken from the product's stock until the order
  // is cancelled or expires
  @Column({ default: 1 })
  quantity: number;

  // In kobo, 1 kobo = 0.01 naira: the price of all the units when ordered
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

  @BeforeInsert()
  generateSlug() {
    this.orderId = `ORD-${this.generateListingSegment(4)}-${this.generateListingSegment(2)}`;
  }

  private generateListingSegment(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    return Array.from(
      { length },
      () => characters[randomInt(characters.length)],
    ).join('');
  }
}
export { OrderStatus };
