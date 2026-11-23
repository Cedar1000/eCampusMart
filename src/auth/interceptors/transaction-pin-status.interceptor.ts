import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, mergeMap } from 'rxjs';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

type AuthMeResponse = {
  user?: Record<string, unknown>;
  [key: string]: unknown;
};

@Injectable()
export class TransactionPinStatusInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<AuthMeResponse> {
    const userId = context
      .switchToHttp()
      .getResponse<{ locals: { user?: { id: string } } }>().locals.user?.id;

    return next.handle().pipe(
      mergeMap(async (response: AuthMeResponse) => {
        if (!userId || !response.user) return response;

        const userWithPin = await this.userRepository
          .createQueryBuilder('user')
          .select(['user.id'])
          .addSelect('user.transactionPinHash')
          .where('user.id = :userId', { userId })
          .getOne();

        return {
          ...response,
          user: {
            ...response.user,
            hasTransactionPin: Boolean(userWithPin?.transactionPinHash),
          },
        };
      }),
    );
  }
}
