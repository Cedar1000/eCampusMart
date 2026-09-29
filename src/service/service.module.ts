import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { Service } from './entities/service.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { ValidServiceCategoryGuard } from './guards/valid-service-category.guard';
import { ValidServiceStoreGuard } from './guards/valid-service-store.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Service, ServiceStore, ServiceCategory])],
  controllers: [ServiceController],
  providers: [
    ServiceService,
    ValidServiceStoreGuard,
    ValidServiceCategoryGuard,
  ],
})
export class ServiceModule {}
