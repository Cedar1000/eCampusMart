import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

// Well past the signup OTP's 2 hours, so nobody is removed mid-signup
export const UNVERIFIED_ACCOUNT_TTL_MS = 24 * 60 * 60 * 1000;

// Signups that were never verified (e.g. the user went back and changed their email)
// would otherwise hold their email and phone number forever
@Injectable()
export class UnverifiedAccountsSweep {
  private readonly logger = new Logger(UnverifiedAccountsSweep.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly authService: AuthService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    try {
      const expired = await this.userRepo.find({
        where: {
          emailVerified: false,
          createdAt: LessThan(new Date(Date.now() - UNVERIFIED_ACCOUNT_TTL_MS)),
        },
        select: ['id'],
      });

      await this.authService.deleteUnverifiedUsers(expired.map(({ id }) => id));

      if (expired.length) {
        this.logger.log(`Removed ${expired.length} unverified accounts`);
      }
    } catch (error) {
      this.logger.error('Unverified accounts sweep failed', error as Error);
    }
  }
}
