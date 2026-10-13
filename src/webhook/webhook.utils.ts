export type PaystackEventData = Record<string, unknown>;

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';
