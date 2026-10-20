export const PAYMENT_QUE = 'payment-que';

export const PAYSTACK_EVENT_JOB = 'paystack-event';

// Retries a failed settlement for about 85 minutes (5s doubling, 10 attempts); the
// app's call to GET /payments/verify settles it sooner
export const PAYSTACK_EVENT_JOB_OPTIONS = {
  attempts: 10,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};
