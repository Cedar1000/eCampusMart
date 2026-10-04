import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Observable, mergeMap } from 'rxjs';
import { User } from 'src/auth/entities/user.entity';
import { Housing } from '../entities/housing.entity';

type HousingResponse = {
  data?: Housing | Housing[];
  [key: string]: unknown;
};

type HousingUser = Pick<
  User,
  'firstName' | 'lastName' | 'photo' | 'ratingsCount' | 'ratingsAverage'
>;

@Injectable()
export class HousingUserDetailsInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (response: HousingResponse) => {
        const responseData = response.data;
        const housings: Housing[] = Array.isArray(responseData)
          ? responseData
          : responseData
            ? [responseData]
            : [];

        const userIds = [
          ...new Set(housings.map((housing) => housing.userId).filter(Boolean)),
        ];

        if (!userIds.length) return response;

        const users = await this.userRepo.find({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true,
            ratingsCount: true,
            ratingsAverage: true,
          },
          where: { id: In(userIds) },
        });

        const usersById = new Map(
          users.map(({ id, ...user }) => [id, user as HousingUser]),
        );
        const addUserDetails = (housing: Housing) => ({
          ...housing,
          user: usersById.get(housing.userId) ?? null,
        });

        return {
          ...response,
          data: Array.isArray(responseData)
            ? housings.map(addUserDetails)
            : responseData
              ? addUserDetails(responseData)
              : responseData,
        };
      }),
    );
  }
}
