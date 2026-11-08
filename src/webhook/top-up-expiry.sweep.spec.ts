import { Logger } from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { verifyPaystackTransaction } from 'utils/paystack';

import { TopUpExpirySweep } from './top-up-expiry.sweep';

jest.mock('utils/paystack');

describe('TopUpExpirySweep', () => {
  const find = jest.fn();
  const wallet = { handle: jest.fn() };
  const sweep = new TopUpExpirySweep({ find } as never, wallet as never);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  const paystackSays = (status: string) =>
    jest.mocked(verifyPaystackTransaction).mockResolvedValueOnce({
      status,
      amount: 1000000,
    });

  it('credits an expired top-up that Paystack says was paid', async () => {
    find.mockResolvedValue([{ reference: 'ref-1' }]);
    paystackSays('success');

    await sweep.sweep();

    expect(wallet.handle).toHaveBeenCalledWith('charge.success', {
      status: 'success',
      amount: 1000000,
      reference: 'ref-1',
    });
  });

  it.each(['abandoned', 'failed', 'ongoing'])(
    'marks an expired top-up Paystack calls %s as failed',
    async (status) => {
      find.mockResolvedValue([{ reference: 'ref-1' }]);
      paystackSays(status);

      await sweep.sweep();

      expect(wallet.handle).toHaveBeenCalledWith(
        'charge.failed',
        expect.objectContaining({ reference: 'ref-1' }),
      );
    },
  );

  it('marks a checkout Paystack never saw as failed', async () => {
    find.mockResolvedValue([{ reference: 'ref-1' }]);
    jest.mocked(verifyPaystackTransaction).mockRejectedValueOnce(
      new AxiosError('Not found', '404', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {},
      }),
    );

    await sweep.sweep();

    expect(wallet.handle).toHaveBeenCalledWith('charge.failed', {
      status: 'failed',
      reference: 'ref-1',
    });
  });

  it('leaves a top-up pending when Paystack is down, and carries on', async () => {
    find.mockResolvedValue([{ reference: 'ref-1' }, { reference: 'ref-2' }]);
    jest
      .mocked(verifyPaystackTransaction)
      .mockRejectedValueOnce(new Error('timeout'));
    paystackSays('success');

    await sweep.sweep();

    expect(wallet.handle).toHaveBeenCalledTimes(1);
    expect(wallet.handle).toHaveBeenCalledWith(
      'charge.success',
      expect.objectContaining({ reference: 'ref-2' }),
    );
  });
});
