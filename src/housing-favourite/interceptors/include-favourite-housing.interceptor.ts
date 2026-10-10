import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, mergeMap } from 'rxjs';
import { In, Repository } from 'typeorm';

import { Housing } from 'src/housing/entities/housing.entity';
import { HousingFavourite } from '../entities/housing-favourite.entity';

type FavouriteWithHousing = HousingFavourite & {
  housing?: Housing | null;
};

type HousingFavouriteResponse = {
  data?: HousingFavourite | HousingFavourite[];
  [key: string]: unknown;
};

@Injectable()
export class IncludeFavouriteHousingInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(Housing)
    private readonly housingRepo: Repository<Housing>,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<HousingFavouriteResponse> {
    return next.handle().pipe(
      mergeMap(async (response: HousingFavouriteResponse) => {
        const responseData = response.data;
        const isFavouriteList = Array.isArray(responseData);
        const favourites = isFavouriteList
          ? responseData
          : responseData
            ? [responseData]
            : [];

        const housingIds = [
          ...new Set(
            favourites
              .map((favourite) => favourite.housingId)
              .filter((housingId): housingId is string => Boolean(housingId)),
          ),
        ];

        if (!housingIds.length) return response;

        const housings = await this.housingRepo.find({
          where: { id: In(housingIds) },
          relations: ['images'],
        });

        const housingsById = new Map(
          housings.map((housing) => [housing.id, housing]),
        );

        const addHousing = (
          favourite: HousingFavourite,
        ): FavouriteWithHousing => ({
          ...favourite,
          housing: favourite.housingId
            ? (housingsById.get(favourite.housingId) ?? null)
            : null,
        });

        return {
          ...response,
          data: isFavouriteList
            ? favourites.map(addHousing)
            : addHousing(favourites[0]),
        };
      }),
    );
  }
}
