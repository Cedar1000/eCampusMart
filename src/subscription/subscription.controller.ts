import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

import { InitializeSubscriptionDto } from './dto/initialize-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { StartFreeTrialDto } from './dto/start-free-trial.dto';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import type IQuery from 'interfaces/query.Interface';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post(['initialize-subscription', 'initialize-transaction'])
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

  @Post('cancel')
  cancel(@Body() dto: CancelSubscriptionDto, @CurrentUser() user: User) {
    return this.subscriptionService.cancelSubscription(dto.storeId, user.id);
  }

  @Post('restart-free')
  restartFree(@Body() dto: CancelSubscriptionDto, @CurrentUser() user: User) {
    return this.subscriptionService.restartFreeMonth(dto.storeId, user.id);
  }

  // The app charges the card check with Paystack first and sends its reference
  @Post('start-free-trial')
  startFreeTrial(@Body() dto: StartFreeTrialDto, @CurrentUser() user: User) {
    return this.subscriptionService.startFreeTrial(dto, user);
  }

  @Post('change-plan')
  @HttpCode(HttpStatus.OK)
  changePlan(
    @Body() dto: ChangeSubscriptionPlanDto,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionService.changePlan(dto, user.id);
  }
}
