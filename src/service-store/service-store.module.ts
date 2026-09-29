import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceStoreService } from './service-store.service';
import { ServiceStoreController } from './service-store.controller';
import { ServiceStore } from './entities/service-store.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { ValidServiceCategoryGuard } from './guards/valid-service-category.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceStore, ServiceCategory])],
  controllers: [ServiceStoreController],
  providers: [ServiceStoreService, ValidServiceCategoryGuard],
})
export class ServiceStoreModule {}
