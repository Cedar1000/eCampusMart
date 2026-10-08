import { BaseEntity } from 'src/common/base.entity';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { Wallet } from 'src/wallet/entities/wallet.entity';

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum TransactionDescription {
  FUND = 'fund',
  WITHDRAW = 'withdraw',
  TRANSFER = 'transfer',
}

@Entity()
export class Transaction extends BaseEntity {
  @Column()
  walletId: string;

  @Column()
  amount: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  beforeBalance?: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  afterBalance?: number;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
  })
  status: TransactionStatus;

  @Column()
  @Index({ unique: true })
  reference: string;

  @Column({
    type: 'enum',
    enum: TransactionDescription,
    default: TransactionDescription.FUND,
  })
  description: TransactionDescription;

  @Column({ default: 'NGN' })
  currency: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, {
    onDelete: 'CASCADE',
  })
  wallet: Wallet;

  @Column()
  expiresAt: Date;
}
