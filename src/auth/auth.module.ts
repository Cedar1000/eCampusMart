import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { Campus } from 'src/campus/entities/campus.entity';
import { DuplicateEmailGuard } from './guards/duplicate-email.guard';
import { ValidCampusGuard } from './guards/valid-campus.guard';
import { UniquePhoneNumberGuard } from './guards/unique-phone-number.guard';
import { WalletModule } from 'src/wallet/wallet.module';
import { ProductStoreModule } from 'src/product-store/product-store.module';
import { ServiceStoreModule } from 'src/service-store/service-store.module';
import { Product } from 'src/product/entities/product.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { Service } from 'src/service/entities/service.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Campus,
      Product,
      ProductStore,
      Service,
      ServiceStore,
    ]),
    WalletModule,
    ProductStoreModule,
    ServiceStoreModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    DuplicateEmailGuard,
    ValidCampusGuard,
    UniquePhoneNumberGuard,
  ],
})
export class AuthModule {}
