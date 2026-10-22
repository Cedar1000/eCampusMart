import {
  BadGatewayException,
  BadRequestException,
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
import {
  getTrialEnd,
  isInFreeMonth,
  isRunningTrial,
  PAID_STATUSES,
} from './store-visibility';

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

  // New stores are off Explore until they start their free trial (POST
  // /subscriptions/start-free-trial) or a plan. trialEndsAt is set so getTrialEnd
  // doesn't fall back to the old automatic free month
  async createServiceStore(createServiceStoreDto: CreateServiceStoreDto) {
    return await factory.createOne(this.serviceStoreRepo, {
      ...createServiceStoreDto,
      trialEndsAt: new Date(),
      hasActiveSubscription: false,
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
   * trial: in the free trial (a plan starting after it) or an old free month · active:
   * on a paid plan · canceled: the seller cancelled the free month or plan · expired:
   * the free month or plan ran out. isFreeTrial is true while the store isn't paying
   * yet (a free trial or an old free month), isOnExplore is what Explore currently
   * shows, and canStartFreeTrial whether POST /subscriptions/start-free-trial would be allowed.
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

      const isFreeTrial = isRunningTrial(paid);

      return {
        status: isFreeTrial ? 'trial' : 'active',
        isFreeTrial,
        plan,
        // Billing starts when the trial ends for plans taken during it
        endsAt: paid.expiresAt,
        renews: paid.status === SubscriptionStatus.ACTIVE,
        trialEndsAt,
        isOnExplore: store.hasActiveSubscription,
        canRestartFree: false,
        canStartFreeTrial: false,
      };
    }

    if (isInFreeMonth(store)) {
      return {
        status: 'trial',
        isFreeTrial: true,
        plan: null,
        endsAt: trialEndsAt,
        renews: false,
        trialEndsAt,
        isOnExplore: store.hasActiveSubscription,
        canRestartFree: false,
        canStartFreeTrial: false,
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
      isFreeTrial: false,
      plan: null,
      endsAt: null,
      renews: false,
      trialEndsAt,
      isOnExplore: store.hasActiveSubscription,
      canRestartFree,
      canStartFreeTrial: !!store.hasFreeTrial,
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
        'hasFreeTrial',
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
      },
    });

    console.log({ subscriptions });

    // Just paid: Paystack hasn't sent the subscription code yet, so it can't be
    // cancelled, and deleting now would leave Paystack billing a deleted store
    // if (subscriptions.some(({ subscriptionCode }) => !subscriptionCode)) {
    //   throw new BadRequestException(
    //     'Subscription is still being set up, please try again shortly',
    //   );
    // }

    // An unfinished checkout paid after the store is gone is refunded by the webhook
    await this.subscriptionRepo.update(
      { storeId, status: SubscriptionStatus.PENDING },
      { status: SubscriptionStatus.FAILED },
    );

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
