import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { deleteCloudinaryImages } from 'utils/cloudinary';

import { Product } from 'src/product/entities/product.entity';
import { ProductImage } from 'src/product/entities/product-image.entity';
import { Service } from 'src/service/entities/service.entity';
import { ServiceImage } from 'src/service/entities/service-image.entity';
import { Housing } from 'src/housing/entities/housing.entity';
import { HousingImage } from 'src/housing/entities/housing-image.entity';

const LISTINGS = {
  product: {
    entity: Product,
    image: ProductImage,
    idField: 'productId',
  },
  service: {
    entity: Service,
    image: ServiceImage,
    idField: 'serviceId',
  },
  housing: {
    entity: Housing,
    image: HousingImage,
    idField: 'housingId',
  },
} as const;

export type ListingType = keyof typeof LISTINGS;

@Injectable()
export class ListingCleanupService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Deletes the matching listings together with their photos (rows and Cloudinary).
   * Favourites are kept, so the user's Saved page can show the listing as deleted.
   * `alsoDelete` runs in the same transaction, e.g. to remove the store, and can
   * return more Cloudinary ids to delete.
   */
  async deleteListings(
    type: ListingType,
    where: Record<string, string>,
    alsoDelete?: (manager: EntityManager) => Promise<string[] | void>,
  ) {
    const { entity, image, idField } = LISTINGS[type];

    const { imageKeys, count } = await this.dataSource.transaction(
      async (manager) => {
        const listings = await manager.find(entity, {
          where,
          select: { id: true },
        });
        const ids = listings.map(({ id }) => id);

        const images = ids.length
          ? await manager.find(image, { where: { [idField]: In(ids) } })
          : [];
        if (ids.length) {
          await manager.delete(image, { [idField]: In(ids) });
          await manager.delete(entity, { id: In(ids) });
        }

        const extraKeys = (await alsoDelete?.(manager)) || [];

        return {
          imageKeys: [...images.map(({ key }) => key), ...extraKeys],
          count: ids.length,
        };
      },
    );

    // Outside the transaction: this can't be rolled back
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
