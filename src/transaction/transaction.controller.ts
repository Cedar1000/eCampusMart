import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Repository } from 'typeorm';
import { PaymentService } from 'src/webhook/payment.service';
import { FormatAmountInterceptor } from './interceptors/format-amount.interceptor';

@Controller('transactions')
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    private readonly paymentService: PaymentService,
  ) {}

  @UseInterceptors(FormatAmountInterceptor)
  @Get('my-transactions')
  async findMyTransactions(@CurrentUser() user: User, query: Partial<IQuery>) {
    const wallet = await this.walletRepo.findOne({
      where: { userId: user.id },
    });

    if (!wallet) throw new NotFoundException('User does not have a wallet');

    query = { ...query, walletId: wallet.id };

    return this.transactionService.findAll(query);
  }

  // Settles a wallet top-up or store subscription straight away if Paystack says
  // it's paid, in case the webhook is late. Same settlement as the webhook, so a
  // payment is only applied once
  @Get('verify/:reference')
  verify(@Param('reference') reference: string, @CurrentUser() user: User) {
    return this.paymentService.verify(reference, user.id);
  }
}
