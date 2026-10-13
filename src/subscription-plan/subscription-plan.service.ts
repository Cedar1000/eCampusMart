import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';

import { SubscriptionPlan } from './entities/subscription-plan.entity';

@Injectable()
export class SubscriptionPlanService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepo: Repository<SubscriptionPlan>,
  ) {}

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.subscriptionPlanRepo, query);
  }
}
