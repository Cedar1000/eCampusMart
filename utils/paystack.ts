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

export const verifyPaystackTransaction = async (reference: string) => {
  const { data } = await paystack().get<{ data: Record<string, unknown> }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );

  return data.data;
};
