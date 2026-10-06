import { Module } from '@nestjs/common';
import { ProductFavouriteService } from './product-favourite.service';
import { ProductFavouriteController } from './product-favourite.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductFavourite } from './entities/product-favourite.entity';
import { Product } from 'src/product/entities/product.entity';
import { IncludeFavouriteProductInterceptor } from './interceptors/include-favourite-product.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([ProductFavourite, Product])],
  controllers: [ProductFavouriteController],
  providers: [ProductFavouriteService, IncludeFavouriteProductInterceptor],
})
export class ProductFavouriteModule {}
