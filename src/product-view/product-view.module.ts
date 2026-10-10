import { Module } from '@nestjs/common';
import { ProductViewService } from './product-view.service';
import { ProductViewController } from './product-view.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductView } from './entities/product-view.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductView])],
  controllers: [ProductViewController],
  providers: [ProductViewService],
  exports: [ProductViewService],
})
export class ProductViewModule {}
