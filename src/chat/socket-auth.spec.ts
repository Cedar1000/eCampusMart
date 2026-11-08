import * as jsonwebtoken from 'jsonwebtoken';

import { socketUserId } from './socket-auth';

const jwt = jsonwebtoken as unknown as {
  sign: (
    payload: object,
    secret: string,
    options?: { expiresIn?: string | number },
  ) => string;
};

describe('socketUserId', () => {
  const SECRET = 'test-secret';
  const token = (id: string, options: { expiresIn?: string | number } = {}) =>
    jwt.sign({ id }, SECRET, { expiresIn: '1h', ...options });

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    delete process.env.CHAT_REQUIRE_TOKEN;
  });

  it('takes the user from auth.token', () => {
    expect(socketUserId({ auth: { token: token('ada') }, headers: {} })).toBe(
      'ada',
    );
  });

  it('takes the user from an Authorization header', () => {
    expect(
      socketUserId({
        auth: {},
        headers: { authorization: `Bearer ${token('ada')}` },
      }),
    ).toBe('ada');
  });

  it('trusts the token over a userid header', () => {
    expect(
      socketUserId({
        auth: { token: token('ada') },
        headers: { userid: 'someone-else' },
      }),
    ).toBe('ada');
  });

  it.each([
    ['forged', () => jwt.sign({ id: 'ada' }, 'wrong-secret')],
    ['expired', () => token('ada', { expiresIn: -10 })],
  ])('refuses a %s token, even with a userid header', (_case, make) => {
    expect(
      socketUserId({ auth: { token: make() }, headers: { userid: 'ada' } }),
    ).toBeNull();
  });

  it('still accepts a plain userid header until tokens are required', () => {
    expect(socketUserId({ auth: {}, headers: { userid: 'ada' } })).toBe('ada');
  });

  it('refuses a plain userid header once CHAT_REQUIRE_TOKEN is set', () => {
    process.env.CHAT_REQUIRE_TOKEN = 'true';

    expect(socketUserId({ auth: {}, headers: { userid: 'ada' } })).toBeNull();
  });
});
