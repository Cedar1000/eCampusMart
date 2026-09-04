import { Module } from '@nestjs/common';
import { ProductStoreService } from './product-store.service';
import { ProductStoreController } from './product-store.controller';

@Module({
  controllers: [ProductStoreController],
  providers: [ProductStoreService],
})
export class ProductStoreModule {}
