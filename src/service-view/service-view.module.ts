import { Module } from '@nestjs/common';
import { ServiceViewService } from './service-view.service';
import { ServiceViewController } from './service-view.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceView } from './entities/service-view.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceView])],
  controllers: [ServiceViewController],
  providers: [ServiceViewService],
  exports: [ServiceViewService],
})
export class ServiceViewModule {}
