import {
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Controller,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import type IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';

import { User } from 'src/auth/entities/user.entity';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ActiveProductGuard } from './guards/active-product.guard';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(ActiveProductGuard)
  create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: User) {
    return this.orderService.create(createOrderDto, user.id);
  }

  @Get('seller')
  findAsSeller(@Query() query: IQuery, @CurrentUser() user: User) {
    return this.orderService.findAll({ ...query, sellerId: user.id });
  }

  @Get('buyer')
  findAsBuyer(@Query() query: IQuery, @CurrentUser() user: User) {
    return this.orderService.findAll({ ...query, buyerId: user.id });
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.orderService.cancel(id, user.id);
  }

  @Patch(':id/complete')
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.orderService.complete(id, user.id);
  }
}
