import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
  Get,
  Query,
  Param,
} from '@nestjs/common';

import { WalletService } from './wallet.service';
import { InitializeTransactionDto } from './dto/initialize-transaction.dto';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { TransactionPinDto } from './dto/transaction-pin.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import {
  FinalizeWithdrawalDto,
  WithdrawWalletDto,
} from './dto/withdraw-wallet.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('initialize-transaction')
  @UsePipes(ValidationPipe)
  initializeTransaction(
    @Body() initializeTransactionDto: InitializeTransactionDto,
    @CurrentUser() user: User,
  ) {
    return this.walletService.initializeTransaction({
      ...initializeTransactionDto,
      userId: user.id,
      email: user.email,
    });
  }

  @Get('banks')
  banks() {
    return this.walletService.getBanks();
  }

  @Get('resolve-account')
  resolveAccount(
    @Query('accountNumber') accountNumber: string,
    @Query('bankCode') bankCode: string,
  ) {
    return this.walletService.resolveAccount(accountNumber, bankCode);
  }

  @Post('pin')
  @UsePipes(ValidationPipe)
  createPin(@Body() payload: TransactionPinDto, @CurrentUser() user: User) {
    return this.walletService.createTransactionPin(user.id, payload.pin);
  }

  @Post('pin/verify')
  @UsePipes(ValidationPipe)
  verifyPin(@Body() payload: TransactionPinDto, @CurrentUser() user: User) {
    return this.walletService.verifyTransactionPin(user.id, payload.pin);
  }

  @Post('transfer')
  @UsePipes(ValidationPipe)
  transfer(@Body() payload: TransferWalletDto, @CurrentUser() user: User) {
    return this.walletService.transferToUser(
      user.id,
      payload.recipientId,
      payload.amount,
      payload.pin,
    );
  }

  @Post('withdraw')
  @UsePipes(ValidationPipe)
  withdraw(@Body() payload: WithdrawWalletDto, @CurrentUser() user: User) {
    return this.walletService.withdraw(user.id, payload);
  }

  @Post('withdraw/:reference/finalize')
  @UsePipes(ValidationPipe)
  finalizeWithdrawal(
    @Param('reference') reference: string,
    @Body() payload: FinalizeWithdrawalDto,
    @CurrentUser() user: User,
  ) {
    return this.walletService.finalizeWithdrawal(
      user.id,
      reference,
      payload.otp,
    );
  }
}
