import { Inject, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server } from 'socket.io';

import { emitToOnline } from 'src/common/live-events/emit-to-online';
import { REDIS_CLIENT } from 'src/redis/constants/redis.constant';
import { Notification } from './entities/notification.entity';

// Shares the chat's socket server; it only sends, so it has no handlers
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationGateway {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  // Sends the saved row as `notification` to its user, if they're connected, so
  // an open Notifications screen updates without reloading. Never throws
  async notify(notification: Notification) {
    try {
      await emitToOnline(
        this.server,
        this.redisClient,
        [notification.userId],
        'notification',
        notification,
      );
    } catch (error) {
      this.logger.error(
        `notification ${notification.id} socket event failed`,
        error,
      );
    }
  }
}
