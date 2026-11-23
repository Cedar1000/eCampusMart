import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import type IQuery from 'interfaces/query.Interface';
import { BankAccountService } from './bank-account.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { TransactionPinDto } from 'src/wallet/dto/transaction-pin.dto';

@Controller('bank-accounts')
export class BankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  create(@Body() dto: CreateBankAccountDto, @CurrentUser() user: User) {
    return this.bankAccountService.create(user.id, dto);
  }

  @Get('my-accounts')
  findAll(@Query() query: IQuery, @CurrentUser() user: User) {
    query.userId = user.id;
    return this.bankAccountService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Partial<IQuery>,
    @CurrentUser() user: User,
  ) {
    return this.bankAccountService.findOne(user.id, id, query);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankAccountDto,
    @CurrentUser() user: User,
  ) {
    return this.bankAccountService.update(user.id, id, dto);
  }

  @Delete(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: TransactionPinDto,
    @CurrentUser() user: User,
  ) {
    return this.bankAccountService.remove(user.id, id, payload.pin);
  }
}
