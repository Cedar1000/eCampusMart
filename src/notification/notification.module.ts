import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Notification } from './entities/notification.entity';
import { PushToken } from './entities/push-token.entity';
import { NotificationController } from './notification.controller';
import { PUSH_QUE } from './notification.constants';
import { PushReceiptsProcessor } from './processors/push-receipts.processor';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushToken, Notification]),
    BullModule.registerQueue({ name: PUSH_QUE }),
  ],
  controllers: [NotificationController],
  providers: [PushService, NotificationService, PushReceiptsProcessor],
  exports: [PushService, NotificationService],
})
export class NotificationModule {}
