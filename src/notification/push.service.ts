import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { In, QueryFailedError, Repository } from 'typeorm';

import { SavePushTokenDto } from './dto/push-token.dto';
import { PushToken } from './entities/push-token.entity';
import {
  PUSH_QUE,
  PUSH_RECEIPTS_JOB,
  PUSH_RECEIPTS_JOB_OPTIONS,
  PushMessage,
} from './notification.constants';

// A sent push still waiting on its receipt
export interface PendingReceipt {
  id: string;
  token: string;
}

// Expo's push API shows richContent.image on the notification
type PushWithImage = ExpoPushMessage & { richContent?: { image: string } };

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  private readonly expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  });

  constructor(
    @InjectRepository(PushToken)
    private readonly tokenRepo: Repository<PushToken>,

    @InjectQueue(PUSH_QUE)
    private readonly pushQueue: Queue,
  ) {}

  // Returns whether the token is new. A token another user had (they signed in
  // on this phone before) moves to this user
  async saveToken(userId: string, { token, platform }: SavePushTokenDto) {
    const updated = await this.tokenRepo.update(
      { token },
      { userId, platform },
    );

    if (updated.affected) return false;

    try {
      await this.tokenRepo.insert({ token, userId, platform });
      return true;
    } catch (error) {
      // Saved by a request at the same moment
      const code = (error as QueryFailedError & { code?: string }).code;
      if (code !== UNIQUE_VIOLATION) throw error;

      await this.tokenRepo.update({ token }, { userId, platform });
      return false;
    }
  }

  // Only the user's own token, so nobody can sign someone else's phone out
  async removeToken(userId: string, token: string) {
    await this.tokenRepo.delete({ token, userId });
  }

  // Pushes to every phone of every user. Never throws: a missed push mustn't
  // fail the request that sent it
  async send(userIds: string[], { title, body, data, image }: PushMessage) {
    try {
      const ids = [...new Set(userIds.filter(Boolean))];
      if (!ids.length) return;

      const tokens = await this.tokenRepo.find({
        where: { userId: In(ids) },
        select: ['id', 'token'],
      });
      if (!tokens.length) return;

      // expo-server-sdk 3.10's types lack richContent, but Expo's push API
      // takes it. mutableContent lets iOS fetch the image before showing it
      const picture: Partial<PushWithImage> = image
        ? { richContent: { image }, mutableContent: true }
        : {};

      const messages: PushWithImage[] = tokens.map(({ token }) => ({
        to: token,
        title,
        body,
        data,
        sound: 'default',
        channelId: 'default',
        ...picture,
      }));

      const pending: PendingReceipt[] = [];
      const dead: string[] = [];

      for (const chunk of this.expo.chunkPushNotifications(messages)) {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);

        // Tickets come back in the order the messages were sent
        tickets.forEach((ticket: ExpoPushTicket, i) => {
          const token = chunk[i].to as string;

          if (ticket.status === 'ok') pending.push({ id: ticket.id, token });
          else if (ticket.details?.error === 'DeviceNotRegistered') {
            dead.push(token);
          } else {
            this.logger.warn(`Push to ${token} failed: ${ticket.message}`);
          }
        });
      }

      await this.removeDeadTokens(dead);

      if (pending.length) {
        await this.pushQueue.add(
          PUSH_RECEIPTS_JOB,
          { receipts: pending },
          PUSH_RECEIPTS_JOB_OPTIONS,
        );
      }
    } catch (error) {
      this.logger.error(`Push "${data.type}" failed`, error as Error);
    }
  }

  // Run by the receipts job. A phone that uninstalled the app reports
  // DeviceNotRegistered here, so its token is removed
  async checkReceipts(receipts: PendingReceipt[]) {
    const tokenById = new Map(receipts.map(({ id, token }) => [id, token]));
    const dead: string[] = [];

    for (const ids of this.expo.chunkPushNotificationReceiptIds([
      ...tokenById.keys(),
    ])) {
      const results = await this.expo.getPushNotificationReceiptsAsync(ids);

      for (const [id, receipt] of Object.entries(results)) {
        if (receipt.status === 'ok') continue;

        const token = tokenById.get(id);
        if (receipt.details?.error === 'DeviceNotRegistered' && token) {
          dead.push(token);
        } else {
          this.logger.warn(`Push receipt ${id} failed: ${receipt.message}`);
        }
      }
    }

    await this.removeDeadTokens(dead);
  }

  private async removeDeadTokens(tokens: string[]) {
    if (!tokens.length) return;

    await this.tokenRepo.delete({ token: In(tokens) });
    this.logger.log(`Removed ${tokens.length} unregistered push tokens`);
  }
}
