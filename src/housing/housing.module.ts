import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HousingService } from './housing.service';
import { HousingController } from './housing.controller';
import { Housing } from './entities/housing.entity';
import { HousingImage } from './entities/housing-image.entity';
import { CampusLocation } from 'src/campus-location/entities/campus-location.entity';
import { ValidCampusLocationGuard } from './guards/valid-campus-location.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Housing, HousingImage, CampusLocation])],
  controllers: [HousingController],
  providers: [HousingService, ValidCampusLocationGuard],
})
export class HousingModule {}
