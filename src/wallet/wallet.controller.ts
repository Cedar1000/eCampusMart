import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
  Headers,
} from '@nestjs/common';

import { WalletService } from './wallet.service';
import { InitializeTransactionDto } from './dto/initialize-transaction.dto';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';

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

  @Post('webhook/paystack')
  @HttpCode(200)
  handlePaystackWebhook(
    @Headers('x-paystack-signature') signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() payload: Record<string, unknown>,
  ) {
    console.log({ signature, payload, rawBody: req.rawBody });
    return this.walletService.handlePaystackWebhook({
      signature,
      payload,
      rawBody: req.rawBody,
    });
  }
}
