import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { User } from 'src/auth/entities/user.entity';

// Listings are shown by campus, so a user must pick one before listing anything.
// Put it first so the user sees this rather than a balance or store error
@Injectable()
export class HasCampusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const { user } = (request.res?.locals ?? {}) as { user?: User };

    if (!user?.campusId) {
      throw new BadRequestException(
        'Please select your campus in your profile before creating a listing',
      );
    }

    return true;
  }
}
