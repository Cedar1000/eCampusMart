import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
  Get,
  Param,
  Patch,
  HttpCode,
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
import { ResolveAccountNumberDto } from './dto/resolve-account-number.dto';
import { VerifyPinOtpDto } from './dto/verify-pin-otp.dto';
import { UpdateTransactionPinDto } from './dto/update-transaction-pin.dto';

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

  @Post('resolve-account')
  resolveAccount(@Body() dto: ResolveAccountNumberDto) {
    return this.walletService.resolveAccount(dto);
  }

  @Post('pin')
  @UsePipes(ValidationPipe)
  createPin(@Body() payload: TransactionPinDto, @CurrentUser() user: User) {
    return this.walletService.createTransactionPin(user.id, payload.pin);
  }

  @Patch('pin')
  @UsePipes(ValidationPipe)
  updatePin(
    @Body() payload: UpdateTransactionPinDto,
    @CurrentUser() user: User,
  ) {
    return this.walletService.updateTransactionPin(
      user.id,
      payload.currentPin,
      payload.newPin,
    );
  }

  @Post('pin/verify')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  verifyPin(@Body() payload: TransactionPinDto, @CurrentUser() user: User) {
    return this.walletService.verifyTransactionPin(user.id, payload.pin);
  }

  @Post('pin/send-otp')
  @HttpCode(200)
  sendPinOtp(@CurrentUser() user: User) {
    return this.walletService.sendPinOtp(user.id);
  }

  @Post('pin/verify-otp')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  verifyPinOtp(@Body() payload: VerifyPinOtpDto, @CurrentUser() user: User) {
    return this.walletService.verifyPinOtp(user.id, payload.otp);
  }

  @Patch('pin/reset/:resetPinToken')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  resetPin(
    @Param('resetPinToken') resetPinToken: string,
    @Body() payload: TransactionPinDto,
  ) {
    return this.walletService.resetTransactionPin(resetPinToken, payload.pin);
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
  @HttpCode(200)
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
