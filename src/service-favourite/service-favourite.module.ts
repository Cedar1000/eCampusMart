import { Module } from '@nestjs/common';
import { ServiceFavouriteService } from './service-favourite.service';
import { ServiceFavouriteController } from './service-favourite.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceFavourite } from './entities/service-favourite.entity';
import { Service } from 'src/service/entities/service.entity';
import { ValidServiceGuard } from './guards/validate-service.guard';
import { IncludeFavouriteServiceInterceptor } from './interceptors/include-favourite-service.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceFavourite, Service])],
  controllers: [ServiceFavouriteController],
  providers: [
    ServiceFavouriteService,
    ValidServiceGuard,
    IncludeFavouriteServiceInterceptor,
  ],
})
export class ServiceFavouriteModule {}
