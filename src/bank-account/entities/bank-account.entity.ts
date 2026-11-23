import { BaseEntity } from 'src/common/base.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Column, Entity, ManyToOne } from 'typeorm';

@Entity()
export class BankAccount extends BaseEntity {
  @Column()
  accountName: string;

  @Column()
  accountNumber: string;

  @Column()
  bankCode: string;

  @Column()
  bankName: string;

  @Column()
  walletId: string;

  @Column()
  userId: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.bankAccounts, {
    onDelete: 'CASCADE',
  })
  wallet: Wallet;
}
