import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { ValidServiceCategoryGuard } from './guards/valid-service-category.guard';
import { ValidServiceStoreGuard } from './guards/valid-service-store.guard';
import { IncludeIsLikedServiceInterceptor } from './interceptors/has-liked-service.interceptor';

import { Service } from './entities/service.entity';
import { ServiceView } from 'src/service-view/entities/service-view.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { ServiceImage } from './entities/service-image.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { BullModule } from '@nestjs/bullmq';
import { SERVICE_QUE } from './service.constant';
import { ServiceProcessor } from './processors/service.processor';
import { ServiceViewService } from 'src/service-view/service-view.service';
import { ServiceFavourite } from 'src/service-favourite/entities/service-favourite.entity';
import { ServiceFavouriteService } from 'src/service-favourite/service-favourite.service';
import { ValidServiceOwnerGuard } from './guards/valid-service-owner.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Service,
      ServiceStore,
      ServiceCategory,
      ServiceImage,
      ServiceView,
      ServiceFavourite,
    ]),

    BullModule.registerQueue({ name: SERVICE_QUE }),
  ],
  controllers: [ServiceController],
  providers: [
    ServiceService,
    IncludeIsLikedServiceInterceptor,
    ValidServiceStoreGuard,
    ValidServiceOwnerGuard,
    ValidServiceCategoryGuard,
    ServiceProcessor,
    ServiceViewService,
    ServiceFavouriteService,
  ],
})
export class ServiceModule {}
