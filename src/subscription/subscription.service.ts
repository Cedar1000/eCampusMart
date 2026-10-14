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
import { In, Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';
import { PlanType } from 'src/subscription-plan/enums/plan-type.enum';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import { TRIAL_CARD_CHECK_AMOUNT, TRIAL_DAYS } from './subscription.constants';

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

    const plan = await this.subscriptionPlanRepo.findOneBy(
      payload.planId ? { id: payload.planId } : { type: payload.plan },
    );

    if (!plan) throw new BadRequestException('Invalid plan');

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

    // One free trial per store: any subscription that ever went through uses it up
    const isTrial = !(await this.subscriptionRepo.exists({
      where: {
        storeId: store.id,
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.NON_RENEWING,
          SubscriptionStatus.INACTIVE,
          SubscriptionStatus.EXPIRED,
          SubscriptionStatus.CANCELLED,
        ]),
      },
    }));

    try {
      const { data: response } = await axios.post<PaystackInitializeResponse>(
        'https://api.paystack.co/transaction/initialize',
        {
          email: payload.email,
          currency,
          reference,
          callback_url: callbackUrl,
          // A trial only verifies a card here; the webhook creates the Paystack
          // subscription with billing starting when the trial ends
          ...(isTrial
            ? { amount: TRIAL_CARD_CHECK_AMOUNT, channels: ['card'] }
            : { plan: plan.paystackId }),
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

      const days = isTrial
        ? TRIAL_DAYS
        : plan.type === PlanType.MONTHLY
          ? 30
          : 365;
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      await this.subscriptionRepo.save(
        this.subscriptionRepo.create({
          userId,
          planId: plan.id,
          storeId: store.id,
          amount: plan.amount * 100, // Store in smallest currency unit
          paystackId: plan.paystackId,
          reference,
          isTrial,
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
          isTrial,
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
