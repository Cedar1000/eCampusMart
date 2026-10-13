import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HousingService } from './housing.service';
import { HousingController } from './housing.controller';
import { Housing } from './entities/housing.entity';
import { HousingImage } from './entities/housing-image.entity';
import { CampusLocation } from 'src/campus-location/entities/campus-location.entity';
import { ValidCampusLocationGuard } from './guards/valid-campus-location.guard';
import { User } from 'src/auth/entities/user.entity';
import { HousingUserDetailsInterceptor } from './interceptors/housing-user-details.interceptor';
import { BullModule } from '@nestjs/bullmq';
import { HOUSING_QUE } from './housing.constants';
import { HousingViewService } from 'src/housing-view/housing-view.service';
import { HousingView } from 'src/housing-view/entities/housing-view.entity';
import { HousingProcessor } from './processors/housing.processor';
import { HousingFavourite } from 'src/housing-favourite/entities/housing-favourite.entity';
import { HousingFavouriteService } from 'src/housing-favourite/housing-favourite.service';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Transaction } from 'src/transaction/entities/transaction.entity';
import { HasHousingUploadBalanceGuard } from './guards/has-housing-upload-balance.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Housing,
      HousingImage,
      CampusLocation,
      User,
      HousingView,
      HousingFavourite,
      Wallet,
      Transaction,
    ]),

    BullModule.registerQueue({ name: HOUSING_QUE }),
  ],
  controllers: [HousingController],
  providers: [
    HousingService,
    ValidCampusLocationGuard,
    HousingUserDetailsInterceptor,
    HasHousingUploadBalanceGuard,
    HousingViewService,
    HousingFavouriteService,
    HousingProcessor,
  ],
})
export class HousingModule {}
