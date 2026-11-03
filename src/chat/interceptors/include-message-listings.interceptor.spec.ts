import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

import { IncludeMessageListingsInterceptor } from './include-message-listings.interceptor';

describe('IncludeMessageListingsInterceptor offers', () => {
  const offerFind = jest.fn();
  const none = { find: jest.fn(() => []) } as never;

  const interceptor = new IncludeMessageListingsInterceptor(none, none, none, {
    find: offerFind,
  } as never);

  const run = (data: object[]) =>
    firstValueFrom(
      interceptor.intercept(
        {} as ExecutionContext,
        { handle: () => of({ data }) } as CallHandler,
      ),
    );

  beforeEach(() => {
    offerFind.mockReset();
    offerFind.mockResolvedValue([
      { id: 'offer-1', amount: 500050, status: 'pending' },
    ]);
  });

  it('attaches the offer, in naira, to messages with an offerId', async () => {
    const { data } = await run([
      { id: 'm1', offerId: 'offer-1' },
      { id: 'm2' },
    ]);

    expect(data).toEqual([
      {
        id: 'm1',
        offerId: 'offer-1',
        offer: { id: 'offer-1', amount: 5000.5, status: 'pending' },
      },
      { id: 'm2' },
    ]);
  });

  it('gives null for an offer that no longer exists', async () => {
    const { data } = await run([{ id: 'm1', offerId: 'gone' }]);

    expect(data).toEqual([{ id: 'm1', offerId: 'gone', offer: null }]);
  });

  it("doesn't look up offers when no message has one", async () => {
    await run([{ id: 'm1' }]);

    expect(offerFind).not.toHaveBeenCalled();
  });
});
