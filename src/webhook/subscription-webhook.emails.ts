import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('en-NG', { dateStyle: 'long' });

// Amounts are stored in the smallest currency unit
const formatAmount = (amount: number) =>
  `NGN ${(Number(amount) / 100).toLocaleString('en-NG')}`;

export const getSubscriptionEmail = (
  event: string,
  subscription: Subscription,
  storeName: string,
): { subject: string; message: string } | null => {
  const amount = formatAmount(subscription.amount);
  const expiresAt = formatDate(subscription.expiresAt);

  switch (event) {
    case 'charge.success':
      if (subscription.isTrial) {
        return {
          subject: 'Free trial started',
          message: `Your free trial for ${storeName} has started and its services are now listed. Your card will be charged ${amount} on ${expiresAt} unless you cancel before then. The small card check charge has been refunded.`,
        };
      }

      return {
        subject: 'Subscription payment received',
        message: `We received your payment of ${amount} for the ${storeName} subscription.`,
      };

    case 'charge.failed':
      return {
        subject: 'Subscription payment failed',
        message: `Your payment of ${amount} for the ${storeName} subscription was not successful. Please try again.`,
      };

    case 'subscription.create':
      return {
        subject: 'Subscription activated',
        message: `Your subscription for ${storeName} is now active. It renews on ${expiresAt}.`,
      };

    case 'subscription.not_renew':
      return {
        subject: 'Subscription will not renew',
        message: `Your subscription for ${storeName} will not renew. It stays active until ${expiresAt}.`,
      };

    case 'subscription.disable':
      return subscription.status === SubscriptionStatus.EXPIRED
        ? {
            subject: 'Subscription ended',
            message: `Your subscription for ${storeName} has ended and its services are no longer listed.`,
          }
        : {
            subject: 'Subscription cancelled',
            message: `Your subscription for ${storeName} has been cancelled and its services are no longer listed.`,
          };

    case 'invoice.create':
      return {
        subject: 'Subscription renewal invoice',
        message: `An invoice of ${amount} has been created for the renewal of your ${storeName} subscription.`,
      };

    case 'invoice.payment_failed':
    case 'invoice.update':
      return subscription.status === SubscriptionStatus.ACTIVE
        ? {
            subject: 'Subscription renewed',
            message: `Your subscription for ${storeName} has been renewed for ${amount}. It is active until ${expiresAt}.`,
          }
        : {
            subject: 'Subscription renewal failed',
            message: `We could not charge ${amount} to renew your ${storeName} subscription, so its services are no longer listed.`,
          };

    default:
      return null;
  }
};
