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

  it('refuses a plain userid header without a token', () => {
    expect(socketUserId({ auth: {}, headers: { userid: 'ada' } })).toBeNull();
  });

  it('refuses a connection with no token at all', () => {
    expect(socketUserId({ auth: {}, headers: {} })).toBeNull();
  });

  it('refuses a token without a user id', () => {
    const noId = jwt.sign({ role: 'user' }, SECRET, { expiresIn: '1h' });

    expect(socketUserId({ auth: { token: noId }, headers: {} })).toBeNull();
  });
});
