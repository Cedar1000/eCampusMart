import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampusLocationService } from './campus-location.service';
import { CampusLocationController } from './campus-location.controller';
import { CampusLocation } from './entities/campus-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CampusLocation])],
  controllers: [CampusLocationController],
  providers: [CampusLocationService],
})
export class CampusLocationModule {}
