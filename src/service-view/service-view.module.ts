import { Module } from '@nestjs/common';
import { ServiceViewService } from './service-view.service';
import { ServiceViewController } from './service-view.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceView } from './entities/service-view.entity';
import { Service } from 'src/service/entities/service.entity';

import { BullModule } from '@nestjs/bullmq';
import { SERVICE_QUE } from 'src/service/service.constant';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceView, Service]),
    BullModule.registerQueue({ name: SERVICE_QUE }),
  ],
  controllers: [ServiceViewController],
  providers: [ServiceViewService],
  exports: [ServiceViewService],
})
export class ServiceViewModule {}
