import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { ClerkProfile } from './clerk.service';
import { User } from './entities/user.entity';

jest.mock('utils/signToken', () => ({
  signToken: (id: string) => ({ token: `token-${id}`, refreshToken: 'r' }),
}));

describe('AuthService Clerk sign-in', () => {
  let service: AuthService;
  let users: Record<string, unknown>[];
  let wallets: Record<string, unknown>[];
  let profile: ClerkProfile;

  const matches = (row: Record<string, unknown>, where: object) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  beforeEach(() => {
    users = [];
    wallets = [];
    profile = {
      clerkId: 'user_clerk',
      email: 'ada@b.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      imageUrl: 'https://img/ada.png',
    };

    const manager = {
      create: (_entity: unknown, data: object) => ({ ...data }),
      save: (row: Record<string, unknown>) => {
        if ('userId' in row) {
          wallets.push(row);
        } else {
          row.id = `id-${users.length + 1}`;
          row.isActive = true;
          users.push(row);
        }
        return row;
      },
    };

    const userRepo = {
      findOne: jest.fn(({ where }: { where: object }) => {
        const row = users.find((user) => matches(user, where));
        return row ? { ...row } : null;
      }),
      find: jest.fn(({ where }: { where: object[] }) =>
        users.filter((user) => where.some((w) => matches(user, w))),
      ),
      update: jest.fn((where: object, changes: object) =>
        users
          .filter((user) => matches(user, where))
          .forEach((user) => Object.assign(user, changes)),
      ),
      manager: {
        transaction: (work: (m: unknown) => unknown) =>
          work({
            ...manager,
            delete: (entity: unknown, where: { id?: { _value: string[] } }) => {
              if (entity === User) {
                users = users.filter(
                  (user) => !where.id?._value.includes(user.id as string),
                );
              }
            },
          }),
      },
    };

    const walletService = {
      findByUserId: (userId: string) =>
        wallets.find((wallet) => wallet.userId === userId) ?? null,
    };
    const stores = { findByUserId: () => null, findByOwnerId: () => null };
    const clerkService = { getProfile: () => profile };

    const unused = {} as never;
    service = new AuthService(
      userRepo as never,
      unused,
      unused,
      unused,
      unused,
      walletService as never,
      stores as never,
      stores as never,
      clerkService as never,
    );
  });

  it('creates a verified, password-less user with a wallet', async () => {
    const result = await service.clerkSignIn('t');

    expect(result.isNewUser).toBe(true);
    expect(result.token).toBe('token-id-1');
    expect(users[0]).toEqual(
      expect.objectContaining({
        email: 'ada@b.com',
        emailVerified: true,
        clerkId: 'user_clerk',
        photo: 'https://img/ada.png',
      }),
    );
    expect(users[0].password).toBeUndefined();
    expect(result.user.wallet).toEqual(
      expect.objectContaining({ userId: 'id-1', balance: 0 }),
    );
  });

  it('signs the same Clerk user back in without creating another account', async () => {
    await service.clerkSignIn('t');
    const result = await service.clerkSignIn('t');

    expect(result.isNewUser).toBe(false);
    expect(users).toHaveLength(1);
    expect(wallets).toHaveLength(1);
  });

  it('links an existing verified account with the same email', async () => {
    users.push({
      id: 'existing',
      email: 'ada@b.com',
      emailVerified: true,
      isActive: true,
      password: 'hash',
    });

    const result = await service.clerkSignIn('t');

    expect(result.isNewUser).toBe(false);
    expect(result.user.id).toBe('existing');
    expect(users[0].clerkId).toBe('user_clerk');
    expect(wallets).toHaveLength(0);
  });

  it('rejects a deactivated account', async () => {
    users.push({
      id: 'existing',
      email: 'ada@b.com',
      emailVerified: true,
      isActive: false,
    });

    await expect(service.clerkSignIn('t')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('unlinks the account when its Clerk user is deleted', async () => {
    await service.clerkSignIn('t');
    await service.unlinkClerkUser('user_clerk');

    expect(users[0].clerkId).toBeNull();
  });

  it('rejects password login for a Google-only account', async () => {
    users.push({
      id: 'google',
      email: 'ada@b.com',
      emailVerified: true,
      isActive: true,
      password: null,
    });

    await expect(
      service.login({
        email: 'ada@b.com',
        password: 'x',
        payload: { email: 'ada@b.com' },
      }),
    ).rejects.toThrow(
      new BadRequestException('Email/Number or password is incorrect'),
    );
  });

  it('lets a Google-only account set its first password via reset', async () => {
    const resetToken = 'reset';
    users.push({
      id: 'google',
      email: 'ada@b.com',
      password: null,
      passwordResetToken: crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex'),
    });

    // The mock ignores the expiry condition, so match on the token alone
    jest
      .spyOn(service['userRepo'], 'findOne')
      .mockResolvedValueOnce({ ...users[0] } as unknown as User);

    await service.resetPassword(resetToken, 'new-password');

    expect(users[0].password).toEqual(expect.any(String));
    expect(users[0].passwordResetToken).toBeNull();
  });
});
