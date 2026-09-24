import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { User } from 'src/auth/entities/user.entity';
import { ProductUserDetailsInterceptor } from './interceptors/product-user-details.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductImage, User])],
  controllers: [ProductController],
  providers: [ProductService, ProductUserDetailsInterceptor],
})
export class ProductModule {}
