import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type IQuery from 'interfaces/query.Interface';
import generateReference from 'utils/generateReference';
import * as factory from 'utils/handlerFactory';
import { InitializeSubscriptionDto } from '../subscription/dto/initialize-subscription.dto';

import axios, { AxiosError } from 'axios';
import { TransactionDescription } from 'src/transaction/entities/transaction.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';
import { PlanType } from 'src/subscription-plan/enums/plan-type.enum';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepo: Repository<ServiceStore>,

    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,

    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepo: Repository<SubscriptionPlan>,

    private readonly configService: ConfigService,
  ) {}

  async initializeTransaction(
    payload: InitializeSubscriptionDto & { userId: string; email: string },
    userId: string,
  ) {
    // verify storeId exists
    const store = await this.serviceStoreRepo.findOneBy({
      id: payload.storeId,
    });

    if (!store) throw new BadRequestException('Invalid storeId');

    // verify storeId belongs to userId
    if (store.ownerId !== userId) {
      throw new BadRequestException('storeId does not belong to user');
    }

    // verify planId exists
    const plan = await this.subscriptionPlanRepo.findOneBy({
      id: payload.planId,
    });

    if (!plan) throw new BadRequestException('Invalid planId');

    const secretKey =
      this.configService.get<string>('PAYSTACK_SECRET_KEY') ||
      process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new InternalServerErrorException(
        'PAYSTACK_SECRET_KEY is not configured',
      );
    }

    if (!payload.email) {
      throw new BadRequestException('Authenticated user email is required');
    }

    const currency = payload.currency?.toUpperCase() || 'NGN';
    const reference = generateReference();

    const callbackUrl =
      payload.callbackUrl ||
      this.configService.get<string>('PAYSTACK_CALLBACK_URL') ||
      process.env.PAYSTACK_CALLBACK_URL;

    try {
      const { data: response } = await axios.post<PaystackInitializeResponse>(
        'https://api.paystack.co/transaction/initialize',
        {
          email: payload.email,
          currency,
          reference,
          callback_url: callbackUrl,
          plan: plan.paystackId,
          metadata: {
            userId: payload.userId,
            storeId: store.id,
            description: TransactionDescription.STORE_SUBSCRIPTION,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const expiresAt =
        plan.type === PlanType.MONTHLY
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      await this.subscriptionRepo.save(
        this.subscriptionRepo.create({
          userId,
          planId: payload.planId,
          storeId: store.id,
          amount: plan.amount * 100, // Store in smallest currency unit
          paystackId: plan.paystackId,
          reference,
          expiresAt,
        }),
      );

      return {
        status: response.status,
        message: response.message,
        data: {
          ...(response.data || {}),
          storeId: store.id,
          reference,
        },
      };
    } catch (error) {
      const paystackError = error as AxiosError<{ message?: string }>;

      console.error(
        'Paystack initialization failed',
        paystackError.response?.data || paystackError.message,
      );
      throw new BadRequestException(
        paystackError.response?.data?.message ||
          'Unable to initialize transaction',
      );
    }
  }

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.subscriptionRepo, query);
  }
}
