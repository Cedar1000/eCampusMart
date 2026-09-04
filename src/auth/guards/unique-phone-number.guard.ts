/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UniquePhoneNumberGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUser = request.res?.locals?.user as User | undefined;
    const { phoneNumber, countryCode } = request.body;

    if (!phoneNumber) return true;

    const existingUser = await this.userRepository.findOne({
      where: { phoneNumber, countryCode },
      select: ['id', 'phoneNumber', 'countryCode'],
    });

    if (existingUser && existingUser.id !== currentUser?.id) {
      throw new ConflictException('Phone number is already exists!');
    }

    return true;
  }
}
