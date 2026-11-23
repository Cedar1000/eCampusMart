import { Module } from '@nestjs/common';
import { BankAccountService } from './bank-account.service';
import { BankAccountController } from './bank-account.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankAccount } from './entities/bank-account.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([BankAccount, Wallet]), WalletModule],
  controllers: [BankAccountController],
  providers: [BankAccountService],
})
export class BankAccountModule {}
