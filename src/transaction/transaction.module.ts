import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { WebhookModule } from 'src/webhook/webhook.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Wallet]), WebhookModule],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
