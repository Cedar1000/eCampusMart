import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, DataSource, In, IsNull } from 'typeorm';

import sendEmail from 'utils/sendEmail';
import { User } from 'src/auth/entities/user.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { TRIAL_DAYS } from 'src/subscription/subscription.constants';
import { formatDate } from 'src/webhook/subscription-webhook.emails';
import {
  FreePlanReminder,
  ServiceStore,
} from './entities/service-store.entity';
import { getTrialEnd, PAID_STATUSES } from './store-visibility';

const DAY = 24 * 60 * 60 * 1000;

// Reminders go out 3 days and 1 day before the free plan ends, and when it ends
const REMIND_FROM = 3 * DAY;
const ORDER: Record<FreePlanReminder, number> = { '3d': 1, '1d': 2, ended: 3 };

// The most urgent reminder that is due; earlier ones that were missed are skipped
export const dueReminder = (endsAt: Date, now: Date): FreePlanReminder => {
  const left = endsAt.getTime() - now.getTime();

  if (left <= 0) return 'ended';
  return left <= DAY ? '1d' : '3d';
};

/**
 * Emails store owners as their free plan runs out, pointing them to subscribe with
 * POST /subscriptions/initialize-subscription. trialReminderSent records the last
 * reminder, so each goes out once; a failed email is retried on the next run.
 */
@Injectable()
export class FreePlanReminderSweep {
  private readonly logger = new Logger(FreePlanReminderSweep.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(now = new Date()) {
    try {
      const stores = await this.findDue(now);

      let sent = 0;

      for (const { store, reminder, endsAt, owner } of stores) {
        if (await this.remind(store, reminder, endsAt, owner)) sent++;
      }

      if (sent) this.logger.log(`Sent ${sent} free plan reminders`);
    } catch (error) {
      this.logger.error('Free plan reminder sweep failed', error as Error);
    }
  }

  private async findDue(now: Date) {
    const from = new Date(now.getTime() - DAY);
    const to = new Date(now.getTime() + REMIND_FROM);
    const trialLength = TRIAL_DAYS * DAY;

    // Free plans ending in the next 3 days or that ended in the last day. Stores from
    // before trialEndsAt was saved end createdAt + TRIAL_DAYS
    const candidates = await this.dataSource.manager.find(ServiceStore, {
      where: [
        { trialCancelled: false, trialEndsAt: Between(from, to) },
        {
          trialCancelled: false,
          trialEndsAt: IsNull(),
          createdAt: Between(
            new Date(from.getTime() - trialLength),
            new Date(to.getTime() - trialLength),
          ),
        },
      ],
      select: [
        'id',
        'name',
        'ownerId',
        'createdAt',
        'trialEndsAt',
        'trialCancelled',
        'trialReminderSent',
      ],
    });

    const due = candidates
      .map((store) => {
        const endsAt = getTrialEnd(store);
        return { store, endsAt, reminder: dueReminder(endsAt, now) };
      })
      // New stores are created with trialEndsAt = createdAt: they never had a free plan
      .filter(
        ({ store, endsAt }) =>
          endsAt.getTime() - new Date(store.createdAt).getTime() > 60 * 1000,
      )
      .filter(
        ({ store, reminder }) =>
          !store.trialReminderSent ||
          ORDER[store.trialReminderSent] < ORDER[reminder],
      );

    if (!due.length) return [];

    const storeIds = due.map(({ store }) => store.id);

    const [paid, owners] = await Promise.all([
      this.dataSource.manager.find(Subscription, {
        where: { storeId: In(storeIds), status: In(PAID_STATUSES) },
        select: ['storeId'],
      }),
      this.dataSource.manager.find(User, {
        where: { id: In(due.map(({ store }) => store.ownerId)) },
        select: ['id', 'email', 'firstName'],
      }),
    ]);

    // A store that subscribed doesn't need reminding
    const paidStoreIds = new Set(paid.map(({ storeId }) => storeId));
    const ownersById = new Map(owners.map((owner) => [owner.id, owner]));

    return due
      .filter(({ store }) => !paidStoreIds.has(store.id))
      .map((entry) => ({
        ...entry,
        owner: ownersById.get(entry.store.ownerId),
      }))
      .filter(
        (entry): entry is typeof entry & { owner: User } => !!entry.owner,
      );
  }

  // Resolves to whether the reminder was sent
  private async remind(
    store: ServiceStore,
    reminder: FreePlanReminder,
    endsAt: Date,
    owner: User,
  ) {
    const name = store.name || 'your store';

    const email =
      reminder === 'ended'
        ? {
            subject: 'Your free plan has ended',
            message: `Your free plan for ${name} has ended and its services are no longer listed on Explore. Subscribe to a plan in the app to list them again.`,
          }
        : {
            subject:
              reminder === '1d'
                ? 'Your free plan ends tomorrow'
                : 'Your free plan ends in 3 days',
            message: `Your free plan for ${name} ends on ${formatDate(endsAt)}. Subscribe to a plan in the app before then to keep your services on Explore.`,
          };

    try {
      await sendEmail({
        to: owner.email,
        subject: email.subject,
        text: `Dear ${owner.firstName || 'there'},\n\n${email.message}`,
      });
    } catch (error) {
      this.logger.error(
        `Free plan reminder ${reminder} failed for store ${store.id}`,
        error as Error,
      );
      return false;
    }

    await this.dataSource.manager.update(ServiceStore, store.id, {
      trialReminderSent: reminder,
    });

    return true;
  }
}
