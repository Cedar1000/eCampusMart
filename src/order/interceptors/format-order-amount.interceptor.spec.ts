import { lastValueFrom, of } from 'rxjs';

import { FormatOrderAmountInterceptor } from './format-order-amount.interceptor';

describe('FormatOrderAmountInterceptor', () => {
  const run = (response: unknown) =>
    lastValueFrom(
      new FormatOrderAmountInterceptor().intercept({} as never, {
        handle: () => of(response),
      }),
    );

  it('shows each order amount in naira', async () => {
    await expect(
      run({ status: 'success', data: [{ id: 'o1', amount: 7500050 }] }),
    ).resolves.toEqual({
      status: 'success',
      data: [{ id: 'o1', amount: 75000.5 }],
    });
  });

  it('leaves a response without data alone', async () => {
    await expect(run({ status: 'success' })).resolves.toEqual({
      status: 'success',
    });
  });
});
