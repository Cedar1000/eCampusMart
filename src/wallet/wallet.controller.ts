import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

import { PaymentService } from 'src/webhook/payment.service';
import { WalletService } from './wallet.service';
import { InitializeTransactionDto } from './dto/initialize-transaction.dto';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly paymentService: PaymentService,
  ) {}

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

  // Credits a top-up straight away if Paystack says it's paid, in case the
  // webhook is late. Same settlement as the webhook, so it's only credited once
  @Get('verify-transaction/:reference')
  verifyTransaction(
    @Param('reference') reference: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentService.verify(reference, user.id);
  }
}
