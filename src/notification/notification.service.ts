import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import {
  Notification,
  NotificationData,
  NotificationType,
} from './entities/notification.entity';
import { NotificationGateway } from './notification.gateway';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}

// Kobo to the naira text the notifications show, e.g. 600000 -> "₦6,000"
export const formatNaira = (kobo: number | string) =>
  `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`;

const HOUR_MS = 60 * 60 * 1000;

// How long until a deadline, e.g. "expires in 24 hrs", "expires in 1 hr" or,
// from 2 days out, "expires in 3 days". Rounded up, so it never undersells
export const formatExpiresIn = (expiresAt: Date, now = new Date()) => {
  const hours = Math.max(
    1,
    Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / HOUR_MS),
  );

  if (hours >= 48) return `expires in ${Math.ceil(hours / 24)} days`;

  return `expires in ${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    private readonly notificationGateway: NotificationGateway,
  ) {}

  // The user's notifications, newest first. The userId filter can't be
  // overridden from the query
  async findAll(query: Partial<IQuery>, userId: string) {
    return await factory.getAll(this.notificationRepo, query, { userId });
  }

  // Marks one of the user's notifications read; 404 for anyone else's
  async markRead(id: string, userId: string) {
    const owned = await this.notificationRepo.exists({ where: { id, userId } });

    if (!owned) throw new NotFoundException('No resource with that ID');

    return await factory.updateOne(this.notificationRepo, id, { isRead: true });
  }

  async markAllRead(userId: string) {
    const { affected } = await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );

    return {
      status: 'success',
      message: 'update successful!',
      data: { updated: affected ?? 0 },
    };
  }

  // Adds notifications to users' lists, and sends each to its user over the
  // socket if they're connected. Never throws: a missed notification mustn't
  // fail the action that caused it
  async create(...notifications: NewNotification[]) {
    const rows = notifications.filter(({ userId }) => !!userId);
    if (!rows.length) return;

    try {
      const saved = await this.notificationRepo.save(
        rows.map((row) =>
          this.notificationRepo.create({ ...row, data: row.data ?? null }),
        ),
      );

      for (const notification of saved) {
        await this.notificationGateway.notify(notification);
      }
    } catch (error) {
      this.logger.error(
        `Saving ${rows.map(({ type }) => type).join(', ')} notifications failed`,
        error as Error,
      );
    }
  }
}
