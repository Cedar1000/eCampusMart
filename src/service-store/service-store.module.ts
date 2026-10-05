import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceStoreService } from './service-store.service';
import { ServiceStoreController } from './service-store.controller';
import { ServiceStore } from './entities/service-store.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { ValidServiceCategoryGuard } from './guards/valid-service-category.guard';
import { UniqueServiceStoreGuard } from './guards/unique-service-store.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceStore, ServiceCategory])],
  controllers: [ServiceStoreController],
  providers: [
    ServiceStoreService,
    ValidServiceCategoryGuard,
    UniqueServiceStoreGuard,
  ],
  exports: [ServiceStoreService],
})
export class ServiceStoreModule {}
