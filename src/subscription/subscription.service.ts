import {
  Injectable,
  BadRequestException,
  BadGatewayException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type IQuery from 'interfaces/query.Interface';
import generateReference from 'utils/generateReference';
import * as factory from 'utils/handlerFactory';
import { InitializeSubscriptionDto } from '../subscription/dto/initialize-subscription.dto';

import axios, { AxiosError } from 'axios';
import {
  Transaction,
  TransactionDescription,
} from 'src/transaction/entities/transaction.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { DataSource, In, Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import {
  Subscription,
  SubscriptionAuthorization,
} from './entities/subscription.entity';
import { StartFreeTrialDto } from './dto/start-free-trial.dto';
import { TRIAL_CARD_CHECK_AMOUNT, TRIAL_DAYS } from './subscription.constants';
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';
import { PlanType } from 'src/subscription-plan/enums/plan-type.enum';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import {
  getTrialEnd,
  isInFreeMonth,
  isRunningTrial,
  PAID_STATUSES,
  syncStoreVisibility,
} from 'src/service-store/store-visibility';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import {
  createPaystackSubscription,
  disablePaystackSubscription,
  fetchPaystackSubscription,
  refundPaystackTransaction,
  verifyPaystackTransaction,
} from 'utils/paystack';
import { asRecord, asString } from 'src/webhook/webhook.utils';
import {
  formatAmount,
  formatDate,
} from 'src/webhook/subscription-webhook.emails';
import sendEmail from 'utils/sendEmail';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: Record<string, unknown>;
}

interface PaystackInitializeBody {
  email: string;
  currency: string;
  reference: string;
  callback_url?: string;
  plan: string;
  start_date?: string;
  metadata: {
    userId: string;
    storeId: string;
    description: TransactionDescription;
  };
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

    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async initializeTransaction(
    payload: InitializeSubscriptionDto & { userId: string; email: string },
    userId: string,
  ) {
    const store = await this.findOwnedStore(payload.storeId, userId);

    // A second checkout would bill the store for two plans at once
    const activeSubscription = await this.subscriptionRepo.findOne({
      where: { storeId: store.id, status: In(PAID_STATUSES) },
      order: { createdAt: 'DESC' },
    });

    // A free trial can be swapped for a plan paid now. The trial is cancelled (here and
    // on Paystack) only once this payment succeeds, so an abandoned checkout keeps it
    const replacesTrial =
      !!activeSubscription && isRunningTrial(activeSubscription);

    if (
      !replacesTrial &&
      activeSubscription?.status === SubscriptionStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Store already has an active subscription, use the change plan endpoint to switch plans',
      );
    }

    if (!replacesTrial && activeSubscription) {
      throw new BadRequestException(
        `Store's current plan runs until ${activeSubscription.expiresAt.toISOString()}, please subscribe again after it ends`,
      );
    }

    const plan = await this.findPlan(payload);

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
    // checked now and billing starts when the free month ends. Replacing a free
    // trial is the opposite: the user wants to pay now
    const trialEndsAt = getTrialEnd(store);
    const isTrial = !replacesTrial && trialEndsAt > new Date();

    const body: PaystackInitializeBody = {
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
    };

    try {
      const { data: response } = await axios.post<PaystackInitializeResponse>(
        'https://api.paystack.co/transaction/initialize',
        body,
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
        { status: SubscriptionStatus.FAILED },
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

    const plan = await this.findPlan(dto);

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

  /**
   * Starts the store's one free trial. The app has charged TRIAL_CARD_CHECK_AMOUNT with
   * Paystack; that card is verified and kept, and Paystack bills the chosen plan to it
   * when the trial ends. The card check is then refunded.
   */
  async startFreeTrial(dto: StartFreeTrialDto, user: User) {
    const { reference, storeId } = dto;

    const store = await this.findOwnedStore(storeId, user.id);
    const plan = await this.findPlan(dto);

    await this.assertCanStartFreeTrial(store, reference);

    const { customerCode, authorization } = await this.verifyCardCheck(
      reference,
      user.email,
    );

    // Claimed before anything is created, so two requests can't both start a trial
    const claimed = await this.serviceStoreRepo
      .createQueryBuilder()
      .update(ServiceStore)
      .set({ hasFreeTrial: false })
      .where('id = :storeId AND "hasFreeTrial" = true', { storeId })
      .execute();

    if (!claimed.affected) {
      throw new ConflictException('Store has already used its free trial');
    }

    console.log({ claimed });

    const releaseClaim = () =>
      this.serviceStoreRepo.update(storeId, { hasFreeTrial: true });

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    let created: { subscription_code: string; email_token: string };

    try {
      created = await createPaystackSubscription({
        customer: customerCode,
        plan: plan.paystackId,
        authorization: authorization.authorizationCode,
        start_date: trialEndsAt.toISOString(),
      });
    } catch (error) {
      console.error('Paystack trial subscription failed', reference, error);
      await releaseClaim();
      throw new BadGatewayException(
        'Could not start the free trial, please try again',
      );
    }

    let subscription: Subscription;

    try {
      subscription = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          manager.create(Subscription, {
            userId: user.id,
            planId: plan.id,
            storeId,
            amount: plan.amount * 100, // Store in smallest currency unit
            paystackId: plan.paystackId,
            reference,
            subscriptionCode: created.subscription_code,
            emailToken: created.email_token,
            status: SubscriptionStatus.ACTIVE,
            isTrial: true,
            expiresAt: trialEndsAt,
            authorization,
          }),
        );

        await manager.update(ServiceStore, storeId, {
          trialEndsAt,
          trialCancelled: false,
        });
        await syncStoreVisibility(manager, storeId);

        return saved;
      });
    } catch (error) {
      // Don't leave Paystack billing a store that has no subscription here
      try {
        await disablePaystackSubscription(
          created.subscription_code,
          created.email_token,
        );
      } catch (rollbackError) {
        console.error(
          'Paystack trial rollback failed',
          created.subscription_code,
          rollbackError,
        );
      }
      await releaseClaim();
      throw error;
    }

    // The card check only proved the card; give the money back
    let refunded = true;

    try {
      await refundPaystackTransaction(reference);
    } catch (error) {
      refunded = false;
      console.error('Trial card check refund failed', reference, error);
    }

    // Not awaited: the trial has started whether or not the email goes out
    void this.sendFreeTrialStartedEmail({
      user,
      storeName: store.name,
      planName: plan.name,
      amount: subscription.amount,
      trialEndsAt,
      last4: authorization.last4,
      refunded,
    });

    const { authorization: _authorization, ...safeSubscription } = subscription;
    void _authorization;

    return {
      status: 'success',
      message: `Free trial started; the ${plan.name} plan begins when it ends`,
      data: { subscription: safeSubscription, trialEndsAt },
    };
  }

  private async sendFreeTrialStartedEmail({
    user,
    storeName,
    planName,
    amount,
    trialEndsAt,
    last4,
    refunded,
  }: {
    user: User;
    storeName: string;
    planName: string;
    amount: number;
    trialEndsAt: Date;
    last4: string;
    refunded: boolean;
  }) {
    const card = last4 ? `your card ending in ${last4}` : 'your card';

    try {
      await sendEmail({
        to: user.email,
        subject: 'Your free trial has started',
        text: [
          `Dear ${user.firstName || 'there'},`,
          `Your free trial for ${storeName} has started, and its services are now listed on Explore.`,
          `The trial runs until ${formatDate(trialEndsAt)}. After that, ${card} will be charged ${formatAmount(amount)} for the ${planName} plan unless you cancel before then.`,
          refunded
            ? `The NGN ${TRIAL_CARD_CHECK_AMOUNT / 100} card check has been refunded.`
            : `The NGN ${TRIAL_CARD_CHECK_AMOUNT / 100} card check will be refunded shortly.`,
        ].join('\n\n'),
      });
    } catch (error) {
      console.error('Free trial email failed', user.id, error);
    }
  }

  // One trial per store, never while it's in its free month or on a plan, and only
  // with a reference nothing else has used
  private async assertCanStartFreeTrial(
    store: ServiceStore,
    reference: string,
  ) {
    const [hadTrial, onPlan, referenceUsed] = await Promise.all([
      this.subscriptionRepo.exists({
        where: { storeId: store.id, isTrial: true },
      }),
      this.subscriptionRepo.exists({
        where: { storeId: store.id, status: In(PAID_STATUSES) },
      }),
      Promise.all([
        this.subscriptionRepo.exists({ where: { reference } }),
        this.transactionRepo.exists({ where: { reference } }),
      ]).then((used) => used.some(Boolean)),
    ]);

    if (!store.hasFreeTrial || hadTrial) {
      throw new BadRequestException('Store has already used its free trial');
    }

    if (isInFreeMonth(store)) {
      throw new BadRequestException('Store is already on its free month');
    }

    if (onPlan) throw new BadRequestException('Store is already on a plan');

    if (referenceUsed) {
      throw new BadRequestException('This payment reference has been used');
    }
  }

  // The app's card check must be a successful, reusable card charge of exactly
  // TRIAL_CARD_CHECK_AMOUNT, made by this user
  private async verifyCardCheck(reference: string, email: string) {
    let data: Record<string, unknown>;

    try {
      data = await verifyPaystackTransaction(reference);
    } catch (error) {
      console.error('Paystack verification failed', reference, error);
      throw new BadGatewayException('Unable to verify the card check');
    }

    const customer = asRecord(data.customer);
    const card = asRecord(data.authorization);

    if (asString(data.status) !== 'success') {
      throw new BadRequestException(
        'The card check payment was not successful',
      );
    }

    if (
      Number(data.amount) !== TRIAL_CARD_CHECK_AMOUNT ||
      asString(data.currency).toUpperCase() !== 'NGN'
    ) {
      throw new BadRequestException(
        `The card check must be NGN ${TRIAL_CARD_CHECK_AMOUNT / 100}`,
      );
    }

    if (asString(customer.email).toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('The card check was not made by you');
    }

    if (card.reusable !== true || !asString(card.authorization_code)) {
      throw new BadRequestException(
        'This card cannot be charged again, please use another card',
      );
    }

    const authorization: SubscriptionAuthorization = {
      authorizationCode: asString(card.authorization_code),
      customerCode: asString(customer.customer_code),
      last4: asString(card.last4),
      expMonth: asString(card.exp_month),
      expYear: asString(card.exp_year),
      cardType: asString(card.card_type),
      bank: asString(card.bank),
      signature: asString(card.signature),
      reusable: true,
    };

    return { customerCode: authorization.customerCode, authorization };
  }

  // A plan id or the plan type the app sends
  private async findPlan(dto: { planId?: string; plan?: PlanType }) {
    const plan = await this.subscriptionPlanRepo.findOneBy(
      dto.planId ? { id: dto.planId } : { type: dto.plan },
    );

    if (!plan) throw new BadRequestException('Invalid plan');

    return plan;
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
