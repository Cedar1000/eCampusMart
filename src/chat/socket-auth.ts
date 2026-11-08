import * as jsonwebtoken from 'jsonwebtoken';
import type { Socket } from 'socket.io';

// jsonwebtoken ships without types here; verify throws on a bad or expired token
const jwt = jsonwebtoken as unknown as {
  verify: (token: string, secret: string) => unknown;
};

// The user a socket connects as, from the access token the REST API uses:
// io(url, { auth: { token } }), or an `Authorization: Bearer …` header.
//
// Until the app sends a token, a plain `userid` header is still accepted, so
// anyone who knows a user's id can connect as them. Set CHAT_REQUIRE_TOKEN=true
// before launch to turn that off.
export const socketUserId = (
  handshake: Pick<Socket['handshake'], 'auth' | 'headers'>,
): string | null => {
  const token = bearerToken(handshake);

  if (token) {
    try {
      const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`);
      const id =
        decoded && typeof decoded === 'object'
          ? (decoded as { id?: unknown }).id
          : null;

      return typeof id === 'string' && id ? id : null;
    } catch {
      // Expired or forged: refused, even when a userid header is also sent
      return null;
    }
  }

  if (process.env.CHAT_REQUIRE_TOKEN === 'true') return null;

  const { userid } = handshake.headers;
  return typeof userid === 'string' && userid ? userid : null;
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
