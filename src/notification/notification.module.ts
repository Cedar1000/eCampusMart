import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PushToken } from './entities/push-token.entity';
import { NotificationController } from './notification.controller';
import { PUSH_QUE } from './notification.constants';
import { PushReceiptsProcessor } from './processors/push-receipts.processor';
import { PushService } from './push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushToken]),
    BullModule.registerQueue({ name: PUSH_QUE }),
  ],
  controllers: [NotificationController],
  providers: [PushService, PushReceiptsProcessor],
  exports: [PushService],
})
export class NotificationModule {}
