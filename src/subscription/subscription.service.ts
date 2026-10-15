import {
  Injectable,
  BadRequestException,
  BadGatewayException,
  NotFoundException,
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
import { DataSource, In, Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';
import { PlanType } from 'src/subscription-plan/enums/plan-type.enum';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import { TRIAL_CARD_CHECK_AMOUNT } from './subscription.constants';
import {
  getTrialEnd,
  isInFreeMonth,
  PAID_STATUSES,
  syncStoreVisibility,
} from 'src/service-store/store-visibility';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import {
  createPaystackSubscription,
  disablePaystackSubscription,
  fetchPaystackSubscription,
} from 'utils/paystack';
import { asRecord, asString } from 'src/webhook/webhook.utils';

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

    private readonly dataSource: DataSource,
  ) {}

  async initializeTransaction(
    payload: InitializeSubscriptionDto & { userId: string; email: string },
    userId: string,
  ) {
    const store = await this.findOwnedStore(payload.storeId, userId);

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

    // Subscribing during the free month doesn't cut it short: the card is only
    // checked now and billing starts when the free month ends
    const trialEndsAt = getTrialEnd(store);
    const isTrial = trialEndsAt > new Date();

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

      const days = plan.type === PlanType.MONTHLY ? 30 : 365;
      const expiresAt = isTrial
        ? trialEndsAt
        : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      // One open checkout per store; a late payment on an older one is still honoured
      await this.subscriptionRepo.update(
        { storeId: store.id, status: SubscriptionStatus.PENDING },
        { status: SubscriptionStatus.EXPIRED },
      );

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

  // Ends the free month and any plan straight away (Paystack's subscription.disable
  // webhook agrees). The seller keeps the store; it just leaves Explore.
  async cancelSubscription(storeId: string, userId: string) {
    const store = await this.findOwnedStore(storeId, userId);

    const subscription = await this.subscriptionRepo.findOne({
      where: {
        storeId,
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.NON_RENEWING,
          SubscriptionStatus.INACTIVE,
        ]),
      },
      order: { createdAt: 'DESC' },
    });

    if (!subscription && !isInFreeMonth(store)) {
      throw new BadRequestException(
        'Store has no free month or plan to cancel',
      );
    }

    if (subscription) {
      if (!subscription.subscriptionCode || !subscription.emailToken) {
        throw new BadRequestException(
          'Subscription is still being set up, please try again shortly',
        );
      }

      try {
        await disablePaystackSubscription(
          subscription.subscriptionCode,
          subscription.emailToken,
        );
      } catch (error) {
        console.error('Paystack subscription disable failed', error);
        throw new BadGatewayException(
          'Could not cancel the subscription, please try again',
        );
      }

      subscription.status = SubscriptionStatus.CANCELLED;
    }

    await this.dataSource.transaction(async (manager) => {
      if (subscription) await manager.save(subscription);
      await manager.update(ServiceStore, storeId, { trialCancelled: true });
      await syncStoreVisibility(manager, storeId);
    });

    return {
      status: 'success',
      message: 'Subscription cancelled',
      data: subscription,
    };
  }

  // After cancelling, the free month can be taken back until its original end date
  async restartFreeMonth(storeId: string, userId: string) {
    const store = await this.findOwnedStore(storeId, userId);

    if (
      await this.subscriptionRepo.exists({
        where: { storeId, status: In(PAID_STATUSES) },
      })
    ) {
      throw new BadRequestException('Store is already on a paid plan');
    }

    const trialEndsAt = getTrialEnd(store);

    if (trialEndsAt <= new Date()) {
      throw new BadRequestException(
        'The free month has ended, please subscribe to a plan',
      );
    }

    if (!store.trialCancelled) {
      throw new BadRequestException('Store is already on its free month');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(ServiceStore, storeId, { trialCancelled: false });
      await syncStoreVisibility(manager, storeId);
    });

    return {
      status: 'success',
      message: 'Free month restarted',
      data: { storeId, trialEndsAt },
    };
  }

  // Paystack can't move a subscription to another plan, so the card on the current one
  // starts a new subscription when the current period ends, then the old one is disabled
  async changePlan(dto: ChangeSubscriptionPlanDto, userId: string) {
    const current = await this.findCurrentSubscription(dto.storeId, userId, [
      SubscriptionStatus.ACTIVE,
    ]);

    const plan = await this.subscriptionPlanRepo.findOneBy(
      dto.planId ? { id: dto.planId } : { type: dto.plan },
    );

    if (!plan) throw new BadRequestException('Invalid plan');

    if (plan.id === current.planId) {
      throw new BadRequestException('Store is already on this plan');
    }

    const startsAt = new Date(
      Math.max(current.expiresAt.getTime(), Date.now() + 60 * 60 * 1000),
    );

    let created: { subscription_code: string; email_token: string };

    try {
      const paystackSubscription = await fetchPaystackSubscription(
        current.subscriptionCode as string,
      );
      const authorization = asRecord(paystackSubscription.authorization);

      if (!authorization.reusable) {
        throw new BadRequestException(
          'The card on this subscription cannot be charged again, please cancel and subscribe to the new plan',
        );
      }

      created = await createPaystackSubscription({
        customer: asString(
          asRecord(paystackSubscription.customer).customer_code,
        ),
        plan: plan.paystackId,
        authorization: asString(authorization.authorization_code),
        start_date: startsAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      console.error('Paystack plan change failed', error);
      throw new BadGatewayException(
        'Could not change the subscription plan, please try again',
      );
    }

    // Saved before the old one is disabled, so its webhook still finds the store subscribed
    const next = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        userId,
        planId: plan.id,
        storeId: current.storeId,
        amount: plan.amount * 100, // Store in smallest currency unit
        paystackId: plan.paystackId,
        reference: generateReference(),
        subscriptionCode: created.subscription_code,
        emailToken: created.email_token,
        status: SubscriptionStatus.ACTIVE,
        // The rest of the current period is still the trial
        isTrial: current.isTrial,
        expiresAt: current.expiresAt,
      }),
    );

    try {
      await disablePaystackSubscription(
        current.subscriptionCode as string,
        current.emailToken as string,
      );
    } catch (error) {
      console.error('Paystack subscription disable failed', error);

      // Undo the new subscription so the store isn't billed for two plans
      try {
        await disablePaystackSubscription(
          created.subscription_code,
          created.email_token,
        );
      } catch (rollbackError) {
        console.error(
          'Paystack plan change rollback failed',
          created.subscription_code,
          rollbackError,
        );
      }
      await this.subscriptionRepo.delete(next.id);

      throw new BadGatewayException(
        'Could not change the subscription plan, please try again',
      );
    }

    current.status = SubscriptionStatus.CANCELLED;
    await this.subscriptionRepo.save(current);

    return {
      status: 'success',
      message: `Subscription changed to the ${plan.name} plan`,
      data: next,
    };
  }

  // The store's latest subscription, as long as it is in one of the given statuses
  // and already linked to Paystack
  private async findCurrentSubscription(
    storeId: string,
    userId: string,
    statuses: SubscriptionStatus[],
  ) {
    await this.findOwnedStore(storeId, userId);

    const subscription = await this.subscriptionRepo.findOne({
      where: {
        storeId,
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.NON_RENEWING,
          SubscriptionStatus.INACTIVE,
        ]),
      },
      order: { createdAt: 'DESC' },
    });

    if (!subscription) {
      throw new NotFoundException('Store has no running subscription');
    }

    if (!statuses.includes(subscription.status)) {
      throw new BadRequestException(
        `Subscription is ${subscription.status} and cannot be changed`,
      );
    }

    if (!subscription.subscriptionCode || !subscription.emailToken) {
      throw new BadRequestException(
        'Subscription is still being set up, please try again shortly',
      );
    }

    return subscription;
  }

  private async findOwnedStore(storeId: string, userId: string) {
    const store = await this.serviceStoreRepo.findOneBy({ id: storeId });

    if (!store) throw new BadRequestException('Invalid storeId');

    if (store.ownerId !== userId) {
      throw new BadRequestException('storeId does not belong to user');
    }

    return store;
  }
}
