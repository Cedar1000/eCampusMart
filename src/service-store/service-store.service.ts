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
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';
import { CreateServiceStoreDto } from './dto/create-service-store.dto';
import { UpdateServiceStoreDto } from './dto/update-service-store.dto';
import { ServiceStore } from './entities/service-store.entity';
import { TRIAL_DAYS } from 'src/subscription/subscription.constants';
import { getTrialEnd, isInFreeMonth, PAID_STATUSES } from './store-visibility';

@Injectable()
export class ServiceStoreService {
  constructor(
    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepo: Repository<ServiceStore>,

    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,

    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepo: Repository<SubscriptionPlan>,

    private readonly listingCleanupService: ListingCleanupService,
  ) {}

  // Every store starts with a free month on Explore
  async createServiceStore(createServiceStoreDto: CreateServiceStoreDto) {
    return await factory.createOne(this.serviceStoreRepo, {
      ...createServiceStoreDto,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      hasActiveSubscription: true,
    });
  }

  // Buyers only see stores on Explore; sellers always see their own
  async findAllServiceStores(
    query: Partial<IQuery> & {
      ownerId?: string;
      hasActiveSubscription?: boolean;
    },
    userId: string,
  ) {
    if (query.ownerId !== userId) query.hasActiveSubscription = true;

    return await factory.getAll(this.serviceStoreRepo, query);
  }

  async findServiceStoreById(
    id: string,
    query: Partial<IQuery>,
    userId: string,
  ) {
    const data = await factory.getOne(this.serviceStoreRepo, id, query);
    const store = data.data as ServiceStore;

    if (store.ownerId !== userId && !store.hasActiveSubscription) {
      throw new NotFoundException('No resource with that ID');
    }

    return { ...data, data: await this.withSubscription(store) };
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

  private async withSubscription<T extends ServiceStore>(store: T) {
    return { ...store, subscription: await this.getSubscriptionState(store) };
  }

  /**
   * trial: in the free month · active: on a paid plan · canceled: the seller cancelled
   * the free month or plan · expired: the free month or plan ran out.
   * isOnExplore is what Explore currently shows.
   */
  private async getSubscriptionState(store: ServiceStore) {
    const trialEndsAt = getTrialEnd(store);

    const paid = await this.subscriptionRepo.findOne({
      where: { storeId: store.id, status: In(PAID_STATUSES) },
      order: { createdAt: 'DESC' },
    });

    if (paid) {
      const plan = await this.subscriptionPlanRepo.findOne({
        where: { id: paid.planId },
        select: ['id', 'name', 'type'],
      });

      return {
        status: 'active',
        plan,
        // Billing starts when the free month ends for plans taken during it
        endsAt: paid.expiresAt,
        renews: paid.status === SubscriptionStatus.ACTIVE,
        trialEndsAt,
        isOnExplore: store.hasActiveSubscription,
        canRestartFree: false,
      };
    }

    if (isInFreeMonth(store)) {
      return {
        status: 'trial',
        plan: null,
        endsAt: trialEndsAt,
        renews: false,
        trialEndsAt,
        isOnExplore: store.hasActiveSubscription,
        canRestartFree: false,
      };
    }

    // Abandoned checkouts never got a Paystack code, so they don't count as a plan
    const lastPlan = await this.subscriptionRepo.findOne({
      where: { storeId: store.id, subscriptionCode: Not(IsNull()) },
      order: { createdAt: 'DESC' },
    });

    const canRestartFree = store.trialCancelled && trialEndsAt > new Date();

    return {
      status:
        canRestartFree || lastPlan?.status === SubscriptionStatus.CANCELLED
          ? 'canceled'
          : 'expired',
      plan: null,
      endsAt: null,
      renews: false,
      trialEndsAt,
      isOnExplore: store.hasActiveSubscription,
      canRestartFree,
    };
  }

  // For /auth/me: the seller's store with the same status as its store page
  async findByOwnerId(ownerId: string) {
    const store = await this.serviceStoreRepo.findOne({
      where: { ownerId },
      select: [
        'id',
        'name',
        'logo',
        'createdAt',
        'trialEndsAt',
        'trialCancelled',
        'hasActiveSubscription',
      ],
    });

    return store ? this.withSubscription(store) : null;
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
