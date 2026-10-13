import { Get, Query, Controller } from '@nestjs/common';

import { SubscriptionPlanService } from './subscription-plan.service';

import type IQuery from 'interfaces/query.Interface';

@Controller('subscription-plans')
export class SubscriptionPlanController {
  constructor(
    private readonly subscriptionPlanService: SubscriptionPlanService,
  ) {}

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    return this.subscriptionPlanService.findAll(query);
  }
}
