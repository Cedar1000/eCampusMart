import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { Transaction } from 'src/transaction/entities/transaction.entity';

@Entity()
export class Wallet extends BaseEntity {
  @Column()
  @Index({ unique: true })
  userId: string;

  @Column({ default: 0, type: 'numeric', precision: 12, scale: 2 })
  balance: number;

  @Column({ default: 'NGN' })
  currency: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Transaction, (transaction) => transaction.wallet)
  transactions: Transaction[];
}
