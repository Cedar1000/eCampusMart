import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { disablePaystackSubscription } from 'utils/paystack';
import { In, Not, IsNull, Repository } from 'typeorm';
import { ListingCleanupService } from 'src/common/listing-cleanup/listing-cleanup.service';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';
import { CreateServiceStoreDto } from './dto/create-service-store.dto';
import { UpdateServiceStoreDto } from './dto/update-service-store.dto';
import { ServiceStore } from './entities/service-store.entity';

@Injectable()
export class ServiceStoreService {
  constructor(
    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepo: Repository<ServiceStore>,

    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,

    private readonly listingCleanupService: ListingCleanupService,
  ) {}

  async createServiceStore(createServiceStoreDto: CreateServiceStoreDto) {
    return await factory.createOne(
      this.serviceStoreRepo,
      createServiceStoreDto,
    );
  }

  async findAllServiceStores(query: Partial<IQuery>) {
    return await factory.getAll(this.serviceStoreRepo, query);
  }

  async findServiceStoreById(id: string, query: Partial<IQuery>) {
    const data = await factory.getOne(this.serviceStoreRepo, id, query);

    return {
      ...data,
      data: await this.withSubscription(data.data as ServiceStore),
    };
  }

  async findMine(ownerId: string) {
    const store = await this.serviceStoreRepo.findOne({ where: { ownerId } });

    if (!store) throw new NotFoundException('You do not have a service store');

    return {
      status: 'success',
      message: 'Get One successful!',
      data: await this.withSubscription(store),
    };
  }

  private async withSubscription(store: ServiceStore) {
    const current = await this.subscriptionRepo.findOne({
      where: {
        storeId: store.id,
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.NON_RENEWING,
        ]),
      },
      order: { createdAt: 'DESC' },
    });

    return {
      ...store,
      subscription: current
        ? {
            status: current.isTrial ? 'trial' : 'paid',
            renews: current.status === SubscriptionStatus.ACTIVE,
            endsAt: current.expiresAt,
          }
        : { status: 'inactive', renews: false, endsAt: null },
    };
  }

  async findByOwnerId(ownerId: string): Promise<ServiceStore | null> {
    return this.serviceStoreRepo.findOne({
      where: { ownerId },
      select: ['id', 'name', 'logo'],
    });
  }

  async updateServiceStore(
    id: string,
    updateServiceStoreDto: UpdateServiceStoreDto,
  ) {
    return await factory.updateOne(
      this.serviceStoreRepo,
      id,
      updateServiceStoreDto,
    );
  }

  // Deleting a store deletes its services, their photos and favourites with it
  async deleteServiceStore(id: string) {
    const store = await this.serviceStoreRepo.findOne({
      where: { id },
      select: ['id', 'logoKey', 'bannerKey'],
    });

    if (!store) throw new NotFoundException('No resource with that ID');

    await this.cancelPaystackSubscriptions(id);

    await this.listingCleanupService.deleteListings(
      'service',
      { storeId: id },
      async (manager) => {
        await manager.delete(ServiceStore, id);

        return [store.logoKey, store.bannerKey].filter(Boolean);
      },
    );

    return { status: 'success', message: 'delete successful!' };
  }

  // Stop Paystack billing first, so a failure leaves the store in place instead of charging for nothing
  private async cancelPaystackSubscriptions(storeId: string) {
    const subscriptions = await this.subscriptionRepo.find({
      where: {
        storeId,
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.NON_RENEWING,
          SubscriptionStatus.INACTIVE,
        ]),
        subscriptionCode: Not(IsNull()),
      },
    });

    for (const subscription of subscriptions) {
      try {
        await disablePaystackSubscription(
          subscription.subscriptionCode as string,
          subscription.emailToken as string,
        );
      } catch (error) {
        console.error('Paystack subscription disable failed', error);

        throw new BadGatewayException(
          'Could not cancel the store subscription, please try again',
        );
      }

      subscription.status = SubscriptionStatus.CANCELLED;
      await this.subscriptionRepo.save(subscription);
    }
  }
}
