import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MessageListingsService } from 'src/chat/message-listings.service';
import { Housing } from 'src/housing/entities/housing.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { Offer } from 'src/offer/entities/offer.entity';
import { Order } from 'src/order/entities/order.entity';
import { Product } from 'src/product/entities/product.entity';
import { Service } from 'src/service/entities/service.entity';
import { PendingReview } from './entities/pending-review.entity';
import { Review } from './entities/review.entity';
import { IncludeReviewListingsInterceptor } from './interceptors/include-review-listings.interceptor';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [
    // PushService and NotificationService, to tell the reviewed user
    NotificationModule,
    TypeOrmModule.forFeature([
      Review,
      PendingReview,
      Order,
      // For the product and service summaries (MessageListingsService)
      Product,
      Service,
      Housing,
      Offer,
    ]),
  ],
  controllers: [ReviewController],
  providers: [
    ReviewService,
    MessageListingsService,
    IncludeReviewListingsInterceptor,
  ],
})
export class ReviewModule {}
