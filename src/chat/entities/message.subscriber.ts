import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  In,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { Conversation } from './conversation.entity';
import { Message, MessageIndentity, MessageStatus } from './message.entity';

export const UNREAD_STATUSES = [MessageStatus.SENT, MessageStatus.DELIVERED];

// The entity that holds a receiver's unreadMessages, by receiverType
const RECEIVER_ENTITIES = {
  [MessageIndentity.USER]: User,
  [MessageIndentity.PRODUCT_STORE]: ProductStore,
  [MessageIndentity.SERVICE_STORE]: ServiceStore,
};

/**
 * Replaces the schema's post('save') hook: after a message is saved, recounts the
 * receiver's unread messages in its conversation and in total. Runs in the same
 * transaction as the save. Like the hook, only save() triggers it, not update() or
 * query builders.
 */
@Injectable()
export class MessageSubscriber implements EntitySubscriberInterface<Message> {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Message;
  }

  async afterInsert({ entity, manager }: InsertEvent<Message>) {
    await this.syncConversation(manager, entity, true);
    await this.syncReceiver(manager, entity);
  }

  // Edits and status changes (e.g. read) change the count, but not the last message
  async afterUpdate({ entity, databaseEntity, manager }: UpdateEvent<Message>) {
    const message = { ...databaseEntity, ...entity };

    if (message.conversationId && message.receiverId) {
      await this.syncConversation(manager, message, false);
      await this.syncReceiver(manager, message);
    }
  }

  // For bulk updates of one receiver's messages in a conversation, which skip the hooks
  async syncUnreadCounts(
    manager: EntityManager,
    message: Pick<Message, 'conversationId' | 'receiverId' | 'receiverType'>,
  ) {
    await this.syncConversation(manager, message, false);
    await this.syncReceiver(manager, message);
  }

  private async syncConversation(
    manager: EntityManager,
    message: Pick<Message, 'conversationId' | 'receiverId'> &
      Partial<Pick<Message, 'id'>>,
    isNew: boolean,
  ) {
    const unreadCount = await manager.count(Message, {
      where: {
        conversationId: message.conversationId,
        receiverId: message.receiverId,
        status: In(UNREAD_STATUSES),
        isDeleted: false,
      },
    });

    // Sets only this receiver's key, so concurrent saves for the other side don't clash
    const update = manager
      .createQueryBuilder()
      .update(Conversation)
      .set({
        unReadCount: () =>
          `jsonb_set(COALESCE("unReadCount", '{}'::jsonb), ARRAY[:receiverId]::text[], to_jsonb(:unreadCount::int))`,
        // lastMessage is a relation; there's no lastMessageId property to set
        ...(isNew && { lastMessage: { id: message.id } }),
      })
      .where('id = :conversationId', {
        conversationId: message.conversationId,
      })
      .setParameters({ receiverId: message.receiverId, unreadCount });

    await update.execute();
  }

  // The receiver's unread messages across all their conversations
  private async syncReceiver(
    manager: EntityManager,
    { receiverId, receiverType }: Pick<Message, 'receiverId' | 'receiverType'>,
  ) {
    const receiver = RECEIVER_ENTITIES[receiverType];

    if (!receiver) return;

    const unreadMessages = await manager.count(Message, {
      where: {
        receiverId,
        receiverType,
        status: In(UNREAD_STATUSES),
        isDeleted: false,
      },
    });

    await manager.update(receiver, { id: receiverId }, { unreadMessages });
  }
}
