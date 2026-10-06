import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, mergeMap } from 'rxjs';
import { In, Repository } from 'typeorm';

import { Service } from 'src/service/entities/service.entity';
import { ServiceFavourite } from '../entities/service-favourite.entity';

type FavouriteWithService = ServiceFavourite & {
  service?: Service | null;
};

type ServiceFavouriteResponse = {
  data?: ServiceFavourite | ServiceFavourite[];
  [key: string]: unknown;
};

@Injectable()
export class IncludeFavouriteServiceInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ServiceFavouriteResponse> {
    return next.handle().pipe(
      mergeMap(async (response: ServiceFavouriteResponse) => {
        const responseData = response.data;
        const isFavouriteList = Array.isArray(responseData);
        const favourites = isFavouriteList
          ? responseData
          : responseData
            ? [responseData]
            : [];

        const serviceIds = [
          ...new Set(
            favourites
              .map((favourite) => favourite.serviceId)
              .filter((serviceId): serviceId is string => Boolean(serviceId)),
          ),
        ];

        if (!serviceIds.length) return response;

        const services = await this.serviceRepo.find({
          where: { id: In(serviceIds) },
          relations: ['images'],
        });

        const servicesById = new Map(
          services.map((service) => [service.id, service]),
        );

        const addService = (
          favourite: ServiceFavourite,
        ): FavouriteWithService => ({
          ...favourite,
          service: favourite.serviceId
            ? (servicesById.get(favourite.serviceId) ?? null)
            : null,
        });

        return {
          ...response,
          data: isFavouriteList
            ? favourites.map(addService)
            : addService(favourites[0]),
        };
      }),
    );
  }
}
