import { EntityManager, In } from 'typeorm';

import { Service } from 'src/service/entities/service.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';
import { TRIAL_DAYS } from 'src/subscription/subscription.constants';
import { ServiceStore } from './entities/service-store.entity';

// A paid plan keeps the store on Explore until Paystack ends it
export const PAID_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.NON_RENEWING,
];

type TrialFields = Pick<
  ServiceStore,
  'createdAt' | 'trialEndsAt' | 'trialCancelled'
>;

export const getTrialEnd = (store: Partial<TrialFields>) =>
  store.trialEndsAt
    ? new Date(store.trialEndsAt)
    : new Date(
        new Date(store.createdAt as Date).getTime() +
          TRIAL_DAYS * 24 * 60 * 60 * 1000,
      );

export const isInFreeMonth = (store: Partial<TrialFields>, now = new Date()) =>
  !store.trialCancelled && getTrialEnd(store) > now;

/**
 * Lists or hides the store and its services: they're on Explore during the free month
 * and while a paid plan runs. Returns whether the store is on Explore.
 */
export const syncStoreVisibility = async (
  manager: EntityManager,
  storeId: string,
) => {
  const [store, hasPaidPlan] = await Promise.all([
    manager.findOne(ServiceStore, {
      where: { id: storeId },
      select: ['id', 'createdAt', 'trialEndsAt', 'trialCancelled'],
    }),
    manager.exists(Subscription, {
      where: { storeId, status: In(PAID_STATUSES) },
    }),
  ]);

  const hasActiveSubscription =
    hasPaidPlan || (!!store && isInFreeMonth(store));

  await manager.update(ServiceStore, storeId, { hasActiveSubscription });
  await manager.update(
    Service,
    { storeId },
    { isActive: hasActiveSubscription },
  );

  return hasActiveSubscription;
};
