import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
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
}
