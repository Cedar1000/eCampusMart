export const PUSH_QUE = 'push-que';

export const PUSH_RECEIPTS_JOB = 'push-receipts';

// Expo has receipts ready within about 15 minutes of sending
export const PUSH_RECEIPTS_JOB_OPTIONS = {
  delay: 15 * 60 * 1000,
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

// What the app reads from a push's `data` to open the right screen
export type PushData =
  | {
      type: 'chat-message';
      conversationId: string;
      receiverId: string;
      messageId: string;
    }
  | {
      type: 'order-updated';
      orderId: string;
      action: 'placed' | 'cancelled' | 'completed' | 'expired';
    }
  | { type: 'offer-updated'; offerId: string; status: string }
  | { type: 'wallet-funded'; reference: string; amount: number }
  | { type: 'subscription-updated'; storeId: string; status: string }
  | { type: 'free-plan-ending'; storeId: string; stage: '3d' | '1d' | 'ended' };

export interface PushMessage {
  title: string;
  body: string;
  data: PushData;
}
