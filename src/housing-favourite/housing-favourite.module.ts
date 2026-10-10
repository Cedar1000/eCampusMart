import { Module } from '@nestjs/common';
import { HousingFavouriteService } from './housing-favourite.service';
import { HousingFavouriteController } from './housing-favourite.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HousingFavourite } from './entities/housing-favourite.entity';
import { Housing } from 'src/housing/entities/housing.entity';
import { BullModule } from '@nestjs/bullmq';
import { HOUSING_FAVOURITE_QUEUE } from './housing.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([HousingFavourite, Housing]),
    BullModule.registerQueue({ name: HOUSING_FAVOURITE_QUEUE }),
  ],
  controllers: [HousingFavouriteController],
  providers: [HousingFavouriteService],
})
export class HousingFavouriteModule {}
