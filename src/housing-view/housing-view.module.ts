import { Module } from '@nestjs/common';
import { HousingViewService } from './housing-view.service';
import { HousingViewController } from './housing-view.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HousingView } from './entities/housing-view.entity';
import { Housing } from 'src/housing/entities/housing.entity';

import { BullModule } from '@nestjs/bullmq';
import { HOUSING_QUE } from 'src/housing/housing.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([HousingView, Housing]),
    BullModule.registerQueue({ name: HOUSING_QUE }),
  ],
  controllers: [HousingViewController],
  providers: [HousingViewService],
  exports: [HousingViewService],
})
export class HousingViewModule {}
