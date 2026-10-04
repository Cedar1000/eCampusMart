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

@Module({
  imports: [
    TypeOrmModule.forFeature([Housing, HousingImage, CampusLocation, User]),
  ],
  controllers: [HousingController],
  providers: [
    HousingService,
    ValidCampusLocationGuard,
    HousingUserDetailsInterceptor,
  ],
})
export class HousingModule {}
