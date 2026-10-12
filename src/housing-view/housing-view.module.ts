import { Module } from '@nestjs/common';
import { HousingViewService } from './housing-view.service';
import { HousingViewController } from './housing-view.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HousingView } from './entities/housing-view.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HousingView])],
  controllers: [HousingViewController],
  providers: [HousingViewService],
  exports: [HousingViewService],
})
export class HousingViewModule {}
