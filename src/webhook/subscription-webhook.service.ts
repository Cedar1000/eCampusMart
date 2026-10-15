import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';
import { PlanType } from 'src/subscription-plan/enums/plan-type.enum';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import sendEmail from 'utils/sendEmail';
import {
  createPaystackSubscription,
  refundPaystackTransaction,
} from 'utils/paystack';
import { syncStoreVisibility } from 'src/service-store/store-visibility';
import { getSubscriptionEmail } from './subscription-webhook.emails';
import { asRecord, asString, PaystackEventData } from './webhook.utils';

@Injectable()
export class SubscriptionWebhookService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepository: Repository<ServiceStore>,

    private readonly dataSource: DataSource,
  ) {}

  async handle(event: string, data: PaystackEventData) {
    const subscription = await this.process(event, data);

    // Not awaited: Paystack only needs the acknowledgement, not the email
    if (subscription) void this.notify(event, subscription);
  }

  // Resolves to the subscription the event changed, or null when nothing changed
  private async process(
    event: string,
    data: PaystackEventData,
  ): Promise<Subscription | null> {
    switch (event) {
      case 'charge.success':
        return this.markSubscriptionSuccessful(this.getReference(data), data);

      case 'charge.failed':
        return this.markSubscriptionFailed(this.getReference(data));

      case 'subscription.create':
        return this.syncSubscription(data, SubscriptionStatus.ACTIVE);

      // Paid period still runs until the next payment date, then subscription.disable follows
      case 'subscription.not_renew':
        return this.syncSubscription(data, SubscriptionStatus.NON_RENEWING);

      case 'subscription.disable':
        return this.syncSubscription(
          data,
          data.status === 'complete'
            ? SubscriptionStatus.EXPIRED
            : SubscriptionStatus.CANCELLED,
        );

      // Sent 3 days ahead of a renewal; nothing changes until the charge is attempted
      case 'invoice.create':
        return this.subscriptionRepository.findOne({
          where: {
            subscriptionCode: asString(
              asRecord(data.subscription).subscription_code,
            ),
          },
          order: { createdAt: 'DESC' },
        });

      case 'invoice.payment_failed':
        return this.syncSubscription(
          this.subscriptionFromInvoice(data),
          SubscriptionStatus.INACTIVE,
        );

      case 'invoice.update':
        return data.paid
          ? this.renewSubscription(data)
          : this.syncSubscription(
              this.subscriptionFromInvoice(data),
              SubscriptionStatus.INACTIVE,
            );

      default:
        return null;
    }
  }

  private async notify(event: string, subscription: Subscription) {
    try {
      const [user, store] = await Promise.all([
        this.userRepository.findOne({ where: { id: subscription.userId } }),
        this.serviceStoreRepository.findOne({
          where: { id: subscription.storeId },
        }),
      ]);

      const email = getSubscriptionEmail(
        event,
        subscription,
        store?.name || 'your store',
      );

      if (!user || !email) return;

      await sendEmail({
        to: user.email,
        subject: email.subject,
        text: `Dear ${user.firstName}, ${email.message}`,
      });
    } catch (error) {
      console.error('Subscription email failed', event, error);
    }
  }

  private getReference(data: PaystackEventData) {
    const reference = asString(data.reference);

    if (!reference) {
      throw new BadRequestException('Missing transaction reference');
    }

    return reference;
  }

  private async markSubscriptionSuccessful(
    reference: string,
    data: PaystackEventData,
  ) {
    const subscription = await this.dataSource.transaction(async (manager) => {
      const subscription = await manager.findOne(Subscription, {
        where: { reference },
        lock: { mode: 'pessimistic_write' },
      });

      // Only the first charge uses our reference; renewals are settled by invoice.update.
      // A checkout replaced by a newer one is expired with no code, but was still paid.
      const isOpenCheckout =
        subscription?.status === SubscriptionStatus.PENDING ||
        (subscription?.status === SubscriptionStatus.EXPIRED &&
          !subscription.subscriptionCode);

      if (!subscription || !isOpenCheckout) return null;

      subscription.status = SubscriptionStatus.ACTIVE;

      // Throws before commit, so Paystack retries the webhook if it fails
      if (subscription.isTrial)
        await this.startTrialBilling(subscription, data);

      await manager.save(subscription);
      await syncStoreVisibility(manager, subscription.storeId);

      return subscription;
    });

    // The trial charge only checked the card, so give it back
    if (subscription?.isTrial) {
      try {
        await refundPaystackTransaction(reference);
      } catch (error) {
        console.error('Trial card check refund failed', reference, error);
      }
    }

    return subscription;
  }

  // Billing for the plan starts on Paystack when the store's free month ends
  private async startTrialBilling(
    subscription: Subscription,
    data: PaystackEventData,
  ) {
    const authorization = asRecord(data.authorization);

    if (!authorization.reusable) {
      throw new BadRequestException(
        'Trial card cannot be charged again, so billing cannot be scheduled',
      );
    }

    // Paystack needs a start date in the future, even if the free month ran out meanwhile
    subscription.expiresAt = new Date(
      Math.max(
        new Date(subscription.expiresAt).getTime(),
        Date.now() + 60 * 60 * 1000,
      ),
    );

    await createPaystackSubscription({
      customer: asString(asRecord(data.customer).customer_code),
      plan: subscription.paystackId,
      authorization: asString(authorization.authorization_code),
      start_date: subscription.expiresAt.toISOString(),
    });
  }

  private async markSubscriptionFailed(reference: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { reference },
    });

    if (!subscription || subscription.status !== SubscriptionStatus.PENDING) {
      return null;
    }

    subscription.status = SubscriptionStatus.FAILED;
    await this.subscriptionRepository.save(subscription);

    return subscription;
  }

  // Invoice events nest the subscription; reshape them like subscription.* payloads
  private subscriptionFromInvoice(data: PaystackEventData) {
    return { ...asRecord(data.subscription), customer: data.customer };
  }

  private async syncSubscription(
    data: PaystackEventData,
    status: SubscriptionStatus,
  ) {
    const subscriptionCode = asString(data.subscription_code);

    return this.dataSource.transaction(async (manager) => {
      const subscription = await this.findSubscription(manager, {
        subscriptionCode,
        email: asString(asRecord(data.customer).email),
        planCode: asString(asRecord(data.plan).plan_code),
      });

      if (!subscription) {
        console.error('Subscription not found', { subscriptionCode, status });
        return null;
      }

      // Paystack can deliver the same event more than once
      const changed =
        subscription.status !== status ||
        (!!subscriptionCode &&
          subscription.subscriptionCode !== subscriptionCode);

      subscription.status = status;

      if (subscriptionCode) subscription.subscriptionCode = subscriptionCode;

      const emailToken = asString(data.email_token);
      if (emailToken) subscription.emailToken = emailToken;

      const nextPaymentDate = new Date(asString(data.next_payment_date));

      if (
        status === SubscriptionStatus.ACTIVE &&
        !Number.isNaN(nextPaymentDate.getTime())
      ) {
        subscription.expiresAt = nextPaymentDate;
      }

      await manager.save(subscription);
      await syncStoreVisibility(manager, subscription.storeId);

      return changed ? subscription : null;
    });
  }

  // Keeps a trail: the row for the period that just ended is expired and the new
  // period gets its own row, carrying the Paystack subscription code forward
  private async renewSubscription(data: PaystackEventData) {
    const invoiceSubscription = asRecord(data.subscription);

    const subscriptionCode = asString(invoiceSubscription.subscription_code);

    const reference =
      asString(asRecord(data.transaction).reference) ||
      asString(data.invoice_code);

    return this.dataSource.transaction(async (manager) => {
      const previous = await this.findSubscription(manager, {
        subscriptionCode,
        email: '',
        planCode: '',
      });

      if (!previous || !reference) {
        console.error('Unable to renew subscription', {
          subscriptionCode,
          reference,
        });
        return null;
      }

      // Paystack can deliver the same invoice more than once
      if (await manager.exists(Subscription, { where: { reference } })) {
        return null;
      }

      previous.status = SubscriptionStatus.EXPIRED;
      await manager.save(previous);

      const renewed = await manager.save(
        manager.create(Subscription, {
          userId: previous.userId,
          planId: previous.planId,
          storeId: previous.storeId,
          paystackId: previous.paystackId,
          amount: previous.amount,
          subscriptionCode,
          emailToken:
            asString(invoiceSubscription.email_token) || previous.emailToken,
          reference,
          status: SubscriptionStatus.ACTIVE,
          expiresAt: await this.getRenewalExpiry(
            manager,
            previous.planId,
            invoiceSubscription.next_payment_date,
          ),
        }),
      );

      await syncStoreVisibility(manager, previous.storeId);

      return renewed;
    });
  }

  private async getRenewalExpiry(
    manager: EntityManager,
    planId: string,
    nextPaymentDate: unknown,
  ) {
    const expiresAt = new Date(asString(nextPaymentDate));

    if (!Number.isNaN(expiresAt.getTime())) return expiresAt;

    const plan = await manager.findOne(SubscriptionPlan, {
      where: { id: planId },
    });
    const days = plan?.type === PlanType.YEARLY ? 365 : 30;

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async findSubscription(
    manager: EntityManager,
    {
      subscriptionCode,
      email,
      planCode,
    }: { subscriptionCode: string; email: string; planCode: string },
  ) {
    if (subscriptionCode) {
      // Renewals share the code, so the latest row is the current period
      const subscription = await manager.findOne(Subscription, {
        where: { subscriptionCode },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      if (subscription) return subscription;
    }

    if (!email || !planCode) return null;

    // Not linked to a Paystack subscription yet: Paystack gives no reference here,
    // so fall back to the customer's latest unlinked checkout for the plan
    const user = await manager.findOne(User, {
      where: { email },
      select: ['id'],
    });

    if (!user) return null;

    return manager.findOne(Subscription, {
      where: {
        userId: user.id,
        paystackId: planCode,
        subscriptionCode: IsNull(),
        status: In([SubscriptionStatus.PENDING, SubscriptionStatus.ACTIVE]),
      },
      order: { createdAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
  }
}
