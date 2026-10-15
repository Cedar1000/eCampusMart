import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import sendEmail from 'utils/sendEmail';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

jest.mock('utils/sendEmail');
jest.mock('utils/generate-random-number', () => ({
  generateRandomNumber: () => 123456,
}));

describe('AuthService email change', () => {
  let service: AuthService;
  let row: Record<string, unknown>;
  let userRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    exists: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const user = { id: 'user-1', email: 'old@b.com', firstName: 'Ada' } as User;

  beforeEach(async () => {
    row = { ...user, password: await bcrypt.hash('secret123', 4) };

    userRepo = {
      findOne: jest.fn(() => ({ ...row })),
      update: jest.fn((_where, changes: Record<string, unknown>) =>
        Object.assign(row, changes),
      ),
      exists: jest.fn(() => false),
      // Mirrors the atomic "attempts < max" update
      createQueryBuilder: jest.fn(() => {
        let column = '';
        const builder = {
          update: () => builder,
          set: (values: Record<string, unknown>) => {
            column = Object.keys(values)[0];
            return builder;
          },
          where: () => builder,
          execute: () => {
            const attempts = Number(row[column] ?? 0);
            if (attempts >= 5) return { affected: 0 };
            row[column] = attempts + 1;
            return { affected: 1 };
          },
        };
        return builder;
      }),
    };

    jest.mocked(sendEmail).mockReset();

    const unused = {} as never;
    service = new AuthService(
      userRepo as never,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
    );
  });

  const request = (password = 'secret123') =>
    service.requestEmailChange(user, 'new@b.com', password);

  it('rejects the request when the password is wrong', async () => {
    await expect(request('wrong')).rejects.toThrow(BadRequestException);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('emails a code to the new address and stores only its hash', async () => {
    await request();

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'new@b.com' }),
    );
    expect(row.pendingEmail).toBe('new@b.com');
    expect(row.emailChangeOtpHash).toEqual(expect.any(String));
    expect(row.emailChangeOtpHash).not.toContain('123456');
    expect(row.otp).toBeUndefined();
  });

  it('changes the email and notifies the old address', async () => {
    await request();

    await expect(service.verifyEmailChange('user-1', 123456)).resolves.toEqual(
      expect.objectContaining({ email: 'new@b.com' }),
    );
    expect(row.email).toBe('new@b.com');
    expect(row.pendingEmail).toBeNull();
    expect(sendEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: 'old@b.com' }),
    );
  });

  it('cancels the change after 5 wrong codes, even if the 6th is right', async () => {
    await request();

    for (let i = 0; i < 5; i++) {
      await expect(service.verifyEmailChange('user-1', 111111)).rejects.toThrow(
        BadRequestException,
      );
    }

    await expect(service.verifyEmailChange('user-1', 123456)).rejects.toThrow(
      ForbiddenException,
    );
    expect(row.pendingEmail).toBeNull();
    expect(row.email).toBe('old@b.com');
  });

  it('rejects an expired code', async () => {
    await request();
    row.emailChangeOtpExpiration = new Date(Date.now() - 1000);

    await expect(service.verifyEmailChange('user-1', 123456)).rejects.toThrow(
      ForbiddenException,
    );
    expect(row.email).toBe('old@b.com');
  });

  it('rejects verification when no change was requested', async () => {
    await expect(service.verifyEmailChange('user-1', 123456)).rejects.toThrow(
      BadRequestException,
    );
  });
});
