import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from 'src/transaction/entities/transaction.entity';
import { User } from 'src/auth/entities/user.entity';
import { BankAccount } from 'src/bank-account/entities/bank-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Transaction, User, BankAccount])],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
