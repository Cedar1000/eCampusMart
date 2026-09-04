/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/auth/guards/duplicate-email.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class DuplicateEmailGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { email, phoneNumber, countryCode } = request.body;

    if (!email) return true;

    const existingUser = await this.userRepository.findOne({
      where: [{ email }, { phoneNumber }, { countryCode }],
      select: ['id', 'email', 'phoneNumber', 'countryCode'],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email is already exists!');
      }
      if (existingUser.phoneNumber === phoneNumber) {
        throw new ConflictException('Phone number is already exists!');
      }
    }

    return true;
  }
}
