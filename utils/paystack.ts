import axios from 'axios';

const paystack = () =>
  axios.create({
    baseURL: 'https://api.paystack.co',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });

export const disablePaystackSubscription = async (
  code: string,
  token: string,
) => paystack().post('/subscription/disable', { code, token });

export const createPaystackSubscription = async (payload: {
  customer: string;
  plan: string;
  authorization: string;
  start_date: string;
}) => {
  const { data } = await paystack().post<{
    data: { subscription_code: string; email_token: string };
  }>('/subscription', payload);

  return data.data;
};

export const fetchPaystackSubscription = async (code: string) => {
  const { data } = await paystack().get<{ data: Record<string, unknown> }>(
    `/subscription/${encodeURIComponent(code)}`,
  );

  return data.data;
};

export const refundPaystackTransaction = async (reference: string) =>
  paystack().post('/refund', { transaction: reference });

export const listPaystackBanks = async (currency = 'NGN') => {
  const { data } = await paystack().get('/bank', {
    params: { currency, perPage: 100 },
  });
  return data.data as Record<string, unknown>[];
};

export const resolvePaystackAccount = async (
  accountNumber: string,
  bankCode: string,
) => {
  const { data } = await paystack().get('/bank/resolve', {
    params: { account_number: accountNumber, bank_code: bankCode },
  });
  return data.data as Record<string, unknown>;
};

export const createPaystackTransferRecipient = async (payload: {
  name: string;
  account_number: string;
  bank_code: string;
  currency: string;
}) => {
  const { data } = await paystack().post('/transferrecipient', {
    type: 'nuban',
    ...payload,
  });
  return data.data as Record<string, unknown>;
};

export const initiatePaystackTransfer = async (payload: {
  amount: number;
  recipient: string;
  reference: string;
  reason: string;
}) => {
  const { data } = await paystack().post('/transfer', {
    source: 'balance',
    currency: 'NGN',
    ...payload,
  });
  return data.data as Record<string, unknown>;
};

export const getPaystackTransfer = async (reference: string) => {
  const { data } = await paystack().get(
    `/transfer/${encodeURIComponent(reference)}`,
  );
  return data.data as Record<string, unknown>;
};

export const finalizePaystackTransfer = async (
  transferCode: string,
  otp: string,
) => {
  const { data } = await paystack().post('/transfer/finalize_transfer', {
    transfer_code: transferCode,
    otp,
  });
  return data.data as Record<string, unknown>;
};

export const createPaystackCustomer = async (payload: {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}) => {
  const { data } = await paystack().post('/customer', payload);
  return data.data as Record<string, unknown>;
};

export const getPaystackCustomer = async (email: string) => {
  const { data } = await paystack().get(
    `/customer/${encodeURIComponent(email)}`,
  );
  return data.data as Record<string, unknown>;
};

export const validatePaystackCustomer = async (
  customerCode: string,
  payload: {
    country: 'NG';
    type: 'bank_account';
    account_number: string;
    bvn: string;
    bank_code: string;
    first_name: string;
    last_name: string;
  },
) =>
  paystack().post(
    `/customer/${encodeURIComponent(customerCode)}/identification`,
    payload,
  );

export const verifyPaystackTransaction = async (reference: string) => {
  const { data } = await paystack().get<{ data: Record<string, unknown> }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );

  return data.data;
};
