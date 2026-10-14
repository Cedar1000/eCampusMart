import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { deleteCloudinaryImages } from 'utils/cloudinary';

import { RedisService } from 'src/redis/redis.service';
import { Product } from 'src/product/entities/product.entity';
import { ProductImage } from 'src/product/entities/product-image.entity';
import { ProductFavourite } from 'src/product-favourite/entities/product-favourite.entity';
import { Service } from 'src/service/entities/service.entity';
import { ServiceImage } from 'src/service/entities/service-image.entity';
import { ServiceFavourite } from 'src/service-favourite/entities/service-favourite.entity';
import { Housing } from 'src/housing/entities/housing.entity';
import { HousingImage } from 'src/housing/entities/housing-image.entity';
import { HousingFavourite } from 'src/housing-favourite/entities/housing-favourite.entity';

const LISTINGS = {
  product: {
    entity: Product,
    image: ProductImage,
    favourite: ProductFavourite,
    idField: 'productId',
    likedSet: 'liked-products',
  },
  service: {
    entity: Service,
    image: ServiceImage,
    favourite: ServiceFavourite,
    idField: 'serviceId',
    likedSet: 'liked-services',
  },
  housing: {
    entity: Housing,
    image: HousingImage,
    favourite: HousingFavourite,
    idField: 'housingId',
    likedSet: 'liked-housing',
  },
} as const;

export type ListingType = keyof typeof LISTINGS;

@Injectable()
export class ListingCleanupService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Deletes the matching listings together with their photos (rows and Cloudinary)
   * and the favourites pointing at them. `alsoDelete` runs in the same transaction,
   * e.g. to remove the store, and can return more Cloudinary ids to delete.
   */
  async deleteListings(
    type: ListingType,
    where: Record<string, string>,
    alsoDelete?: (manager: EntityManager) => Promise<string[] | void>,
  ) {
    const { entity, image, favourite, idField, likedSet } = LISTINGS[type];

    const { imageKeys, favourites, count } = await this.dataSource.transaction(
      async (manager) => {
        const listings = await manager.find(entity, {
          where,
          select: { id: true },
        });
        const ids = listings.map(({ id }) => id);

        const images = ids.length
          ? await manager.find(image, { where: { [idField]: In(ids) } })
          : [];
        const favourites = ids.length
          ? await manager.find(favourite, {
              where: { [idField]: In(ids) },
              select: { userId: true, [idField]: true },
            })
          : [];

        if (ids.length) {
          await manager.delete(favourite, { [idField]: In(ids) });
          await manager.delete(image, { [idField]: In(ids) });
          await manager.delete(entity, { id: In(ids) });
        }

        const extraKeys = (await alsoDelete?.(manager)) || [];

        return {
          imageKeys: [...images.map(({ key }) => key), ...extraKeys],
          favourites,
          count: ids.length,
        };
      },
    );

    // Outside the transaction: these can't be rolled back
    await Promise.all(
      favourites.map((row) =>
        this.redisService.srem(
          `user:${row.userId}:${likedSet}`,
          String(row[idField as keyof typeof row]),
        ),
      ),
    );
    await deleteCloudinaryImages(imageKeys);

    return count;
  }

  /** Deletes Cloudinary photos that an edit dropped from a listing */
  async deleteReplacedImages(
    previousKeys: string[],
    images: { key?: string }[],
  ) {
    const kept = new Set(images.map(({ key }) => key));

    await deleteCloudinaryImages(previousKeys.filter((key) => !kept.has(key)));
  }
}
