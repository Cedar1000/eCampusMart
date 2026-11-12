import * as jsonwebtoken from 'jsonwebtoken';
import type { Socket } from 'socket.io';

// jsonwebtoken ships without types here; verify throws on a bad or expired token
const jwt = jsonwebtoken as unknown as {
  verify: (token: string, secret: string) => unknown;
};

// The user a socket connects as, from the access token the REST API uses:
// io(url, { auth: { token } }), or an `Authorization: Bearer …` header.
// Null without a valid token: a `userid` header alone is never trusted, since
// anyone who knows a user's id could then connect as them. The gateway also
// checks the user still exists, as the REST middleware does
export const socketUserId = (
  handshake: Pick<Socket['handshake'], 'auth' | 'headers'>,
): string | null => {
  const token = bearerToken(handshake);

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`);
    const id =
      decoded && typeof decoded === 'object'
        ? (decoded as { id?: unknown }).id
        : null;

    return typeof id === 'string' && id ? id : null;
  } catch {
    // Expired or forged
    return null;
  }
};

const bearerToken = ({
  auth,
  headers,
}: Pick<Socket['handshake'], 'auth' | 'headers'>) => {
  const fromAuth = (auth as { token?: unknown } | undefined)?.token;
  if (typeof fromAuth === 'string' && fromAuth) {
    return fromAuth.replace(/^Bearer\s+/i, '');
  }

  const header = headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }

  return null;
};
