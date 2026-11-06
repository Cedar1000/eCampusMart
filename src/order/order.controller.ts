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
  UseInterceptors,
} from '@nestjs/common';

import type IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';

import { User } from 'src/auth/entities/user.entity';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RateOrderDto } from './dto/rate-order.dto';
import { OrderRatingService } from './order-rating.service';
import { IncludeOrderRatingsInterceptor } from './interceptors/include-order-ratings.interceptor';
import { ActiveProductGuard } from './guards/active-product.guard';
import { IncludePartiesInterceptor } from 'src/common/interceptors/include-parties.interceptor';
import { FormatOrderAmountInterceptor } from './interceptors/format-order-amount.interceptor';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderRatingService: OrderRatingService,
  ) {}

  @Post()
  @UseGuards(ActiveProductGuard)
  create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: User) {
    return this.orderService.create(createOrderDto, user.id);
  }

  @Get('seller')
  @UseInterceptors(
    FormatOrderAmountInterceptor,
    IncludePartiesInterceptor,
    IncludeOrderRatingsInterceptor,
  )
  findAsSeller(@Query() query: IQuery, @CurrentUser() user: User) {
    return this.orderService.findAll({ ...query, sellerId: user.id });
  }

  @Get('buyer')
  @UseInterceptors(
    FormatOrderAmountInterceptor,
    IncludePartiesInterceptor,
    IncludeOrderRatingsInterceptor,
  )
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

  // The buyer or seller rates the other side, once, after completion
  @Post(':id/rating')
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rateOrderDto: RateOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.orderRatingService.rate(id, rateOrderDto, user.id);
  }
}
