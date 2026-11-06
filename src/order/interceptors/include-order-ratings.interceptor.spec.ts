import { lastValueFrom, of } from 'rxjs';

import { IncludeOrderRatingsInterceptor } from './include-order-ratings.interceptor';

describe('IncludeOrderRatingsInterceptor', () => {
  const ratingService = {
    findRatings: jest.fn((ids: string[]) =>
      Object.fromEntries(
        ids.map((id) => [id, { buyer: { stars: 5 }, seller: null }]),
      ),
    ),
  };
  const run = (response: unknown) =>
    lastValueFrom(
      new IncludeOrderRatingsInterceptor(ratingService as never).intercept(
        {} as never,
        { handle: () => of(response) },
      ),
    );

  it('adds both sides’ ratings to each order', async () => {
    await expect(run({ data: [{ id: 'o1' }, { id: 'o2' }] })).resolves.toEqual({
      data: [
        { id: 'o1', ratings: { buyer: { stars: 5 }, seller: null } },
        { id: 'o2', ratings: { buyer: { stars: 5 }, seller: null } },
      ],
    });
    expect(ratingService.findRatings).toHaveBeenCalledWith(['o1', 'o2']);
  });

  it('leaves a response without data alone', async () => {
    await expect(run({ status: 'success' })).resolves.toEqual({
      status: 'success',
    });
  });
});
