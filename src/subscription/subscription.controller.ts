import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

import { InitializeSubscriptionDto } from './dto/initialize-subscription.dto';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import type IQuery from 'interfaces/query.Interface';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('initialize-subscription')
  initializeTransaction(
    @Body() dto: InitializeSubscriptionDto,
    @CurrentUser() user: User,
  ) {
    dto.email = user.email;
    return this.subscriptionService.initializeTransaction(dto, user.id);
  }

  @Get('my-subscriptions')
  findAll(@Query() query: Partial<IQuery>, @CurrentUser() user: User) {
    return this.subscriptionService.findAll({ ...query, userId: user.id });
  }
}
