import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, ArrayOverlap, In, MoreThan, Repository } from 'typeorm';
import * as factory from 'utils/handlerFactory';
import IQuery from 'interfaces/query.Interface';
import { CreateChatDto } from './dto/create-chat.dto';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { Conversation, ConversationType } from './entities/conversation.entity';
import {
  Message,
  MessageIndentity,
  MessageStatus,
} from './entities/message.entity';
import {
  MessageSubscriber,
  UNREAD_STATUSES,
} from './entities/message.subscriber';
import { User } from 'src/auth/entities/user.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';

export interface ConversationRecipient {
  id: string;
  type: MessageIndentity;
  name: string;
  photo: string | null;
  ratingsAverage: number;
  ratingsCount: number;
}

export interface UserStoreIds {
  productStoreIds: string[];
  serviceStoreIds: string[];
}

// The user's id and their stores' ids: everyone they can chat as
export const onlineIdsOf = (
  userId: string,
  { productStoreIds, serviceStoreIds }: UserStoreIds,
) => [userId, ...productStoreIds, ...serviceStoreIds];

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,

    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(ProductStore)
    private readonly productStoreRepo: Repository<ProductStore>,

    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepo: Repository<ServiceStore>,

    private readonly messageSubscriber: MessageSubscriber,
  ) {}

  // Saves a message, with the sender and receiver types looked up from their ids.
  // The sender must be the user or one of their stores
  async create(createChatDto: CreateChatDto, userId: string) {
    const { senderId, receiverId } = createChatDto;

    await this.assertOwnParticipant(userId, senderId);

    if (senderId === receiverId) {
      throw new BadRequestException("You can't send a message to yourself");
    }

    if (
      createChatDto.conversationId &&
      !(await this.conversationRepo.exists({
        where: {
          id: createChatDto.conversationId,
          participants: ArrayContains([senderId, receiverId]),
        },
      }))
    ) {
      throw new ForbiddenException(
        'The conversation is not between the sender and receiver',
      );
    }

    const participants = await this.findRecipients([senderId, receiverId]);
    const sender = participants.get(senderId);
    const receiver = participants.get(receiverId);

    if (!sender) throw new NotFoundException(`Sender ${senderId} not found`);

    if (!receiver) {
      throw new NotFoundException(`Receiver ${receiverId} not found`);
    }

    const conversationId =
      createChatDto.conversationId ??
      (await this.findOrCreateConversation(senderId, receiverId)).id;

    return this.messageRepo.save(
      this.messageRepo.create({
        ...createChatDto,
        conversationId,
        senderType: sender.type,
        receiverType: receiver.type,
      }),
    );
  }

  // Marks the receivers' sent messages (optionally only messageIds) as delivered and
  // returns the ones that changed. Delivered still counts as unread, so skipping
  // MessageSubscriber here is fine
  async markDelivered(receiverIds: string[], messageIds?: string[]) {
    if (!receiverIds.length) return [];

    const result = await this.messageRepo
      .createQueryBuilder()
      .update(Message)
      .set({ status: MessageStatus.DELIVERED })
      .where({
        receiverId: In(receiverIds),
        status: MessageStatus.SENT,
        ...(messageIds && { id: In(messageIds) }),
      })
      .returning(['id', 'senderId', 'conversationId'])
      .execute();

    return result.raw as Pick<Message, 'id' | 'senderId' | 'conversationId'>[];
  }

  private async findOrCreateConversation(senderId: string, receiverId: string) {
    const conversation = await this.conversationRepo.findOne({
      where: {
        type: ConversationType.PRIVATE,
        participants: ArrayContains([senderId, receiverId]),
      },
    });

    return (
      conversation ??
      this.conversationRepo.save(
        this.conversationRepo.create({
          participants: [senderId, receiverId],
          createdBy: senderId,
        }),
      )
    );
  }

  // Conversations the participant is in, most recently active first
  async findAllConversations(participantId: string, query: Partial<IQuery>) {
    // participants is an array column, so filter it here rather than via the query
    delete query['participants'];
    query.sort ??= 'desc-updatedAt';

    const result = await factory.getAll(this.conversationRepo, query, {
      participants: ArrayContains([participantId]),
    });

    const conversations = result.data as Conversation[];
    const recipients = await this.findRecipients(
      conversations.flatMap((c) =>
        (c.participants ?? []).filter((id) => id !== participantId),
      ),
    );

    result.data = conversations.map((conversation) => {
      const recipientId = conversation.participants?.find(
        (id) => id !== participantId,
      );
      const clearedAt = conversation.clearedAt?.[participantId];
      const { lastMessage } = conversation;

      return {
        ...conversation,
        // A cleared chat has no last message until a new one arrives
        lastMessage:
          lastMessage &&
          clearedAt &&
          lastMessage.createdAt <= new Date(clearedAt)
            ? null
            : lastMessage,
        recipient: (recipientId && recipients.get(recipientId)) || null,
      };
    });

    return result;
  }

  // Messages in the conversation, newest first, leaving out ones the user cleared.
  // The user, or one of their stores, must be a participant
  async findAllMessages(
    userId: string,
    conversationId: string,
    query: Partial<IQuery>,
  ) {
    const { conversation, ownIds } = await this.findOwnConversation(
      userId,
      conversationId,
    );

    delete query['conversationId'];
    query.sort ??= 'desc-createdAt';

    const clearedAt = this.clearedAtFor(conversation, ownIds);

    return factory.getAll(this.messageRepo, query, {
      conversationId,
      ...(clearedAt && { createdAt: MoreThan(clearedAt) }),
    });
  }

  // Hides the conversation's messages so far from the user and their stores in it.
  // The other participant still sees them
  async clearConversation(userId: string, conversationId: string) {
    const { ownIds } = await this.findOwnConversation(userId, conversationId);

    const clearedAt = new Date().toISOString();
    const cleared = Object.fromEntries(ownIds.map((id) => [id, clearedAt]));

    // Merges only these keys, so a clear by the other participant isn't overwritten
    await this.conversationRepo
      .createQueryBuilder()
      .update(Conversation)
      .set({
        clearedAt: () =>
          `COALESCE("clearedAt", '{}'::jsonb) || :cleared::jsonb`,
      })
      .where('id = :conversationId', { conversationId })
      .setParameters({ cleared: JSON.stringify(cleared) })
      .execute();

    return {
      status: 'success',
      message: 'Chat cleared',
      data: { conversationId, clearedAt },
    };
  }

  // The conversation and which of its participants are the user or their stores;
  // 403 if neither is in it
  private async findOwnConversation(userId: string, conversationId: string) {
    const stores = await this.findUserStoreIds(userId);
    const userIds = stores ? onlineIdsOf(userId, stores) : [];

    const conversation =
      userIds.length &&
      (await this.conversationRepo.findOne({
        where: { id: conversationId, participants: ArrayOverlap(userIds) },
      }));

    if (!conversation) {
      throw new ForbiddenException('You are not in this conversation');
    }

    const ownIds = conversation.participants.filter((id) =>
      userIds.includes(id),
    );

    return { conversation, ownIds };
  }

  // The latest time any of the ids cleared the conversation
  private clearedAtFor(conversation: Conversation, ids: string[]) {
    const times = ids
      .map((id) => conversation.clearedAt?.[id])
      .filter((time): time is string => !!time)
      .map((time) => new Date(time));

    return times.length
      ? new Date(Math.max(...times.map((time) => time.getTime())))
      : null;
  }

  // Throws unless participantId is the user or one of their stores
  async assertOwnParticipant(userId: string, participantId: string) {
    if (participantId === userId) return;

    const stores = await this.findUserStoreIds(userId);

    if (!stores || !onlineIdsOf(userId, stores).includes(participantId)) {
      throw new ForbiddenException(
        'You can only send as yourself or one of your stores',
      );
    }
  }

  // Participant ids can be users, product stores or service stores; look each up
  // in all three, one query per table
  private async findRecipients(ids: string[]) {
    const recipients = new Map<string, ConversationRecipient>();
    const uniqueIds = [...new Set(ids)];

    if (!uniqueIds.length) return recipients;

    const [users, productStores, serviceStores] = await Promise.all([
      this.userRepo.find({
        where: { id: In(uniqueIds) },
        select: [
          'id',
          'firstName',
          'lastName',
          'photo',
          'ratingsAverage',
          'ratingsCount',
        ],
      }),
      this.productStoreRepo.find({
        where: { id: In(uniqueIds) },
        select: ['id', 'name', 'logo', 'ratingsAverage', 'ratingsCount'],
      }),
      this.serviceStoreRepo.find({
        where: { id: In(uniqueIds) },
        select: ['id', 'name', 'logo', 'ratingsAverage', 'ratingsCount'],
      }),
    ]);

    const ratings = (participant: {
      ratingsAverage?: number;
      ratingsCount?: number;
    }) => ({
      ratingsAverage: participant.ratingsAverage ?? 0,
      ratingsCount: participant.ratingsCount ?? 0,
    });

    users.forEach((user) =>
      recipients.set(user.id, {
        id: user.id,
        type: MessageIndentity.USER,
        name: [user.firstName, user.lastName].filter(Boolean).join(' '),
        photo: user.photo ?? null,
        ...ratings(user),
      }),
    );

    productStores.forEach((store) =>
      recipients.set(store.id, {
        id: store.id,
        type: MessageIndentity.PRODUCT_STORE,
        name: store.name ?? '',
        photo: store.logo ?? null,
        ...ratings(store),
      }),
    );

    serviceStores.forEach((store) =>
      recipients.set(store.id, {
        id: store.id,
        type: MessageIndentity.SERVICE_STORE,
        name: store.name,
        photo: store.logo ?? null,
        ...ratings(store),
      }),
    );

    return recipients;
  }

  // Ids of the user's product and service stores, or null if the user doesn't exist
  async findUserStoreIds(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id'],
    });

    if (!user) return null;

    const [productStores, serviceStores] = await Promise.all([
      this.productStoreRepo.find({ where: { userId }, select: ['id'] }),
      this.serviceStoreRepo.find({
        where: { ownerId: userId },
        select: ['id'],
      }),
    ]);

    return {
      productStoreIds: productStores.map((store) => store.id),
      serviceStoreIds: serviceStores.map((store) => store.id),
    };
  }

  // Sets isOnline on the user and all their stores
  async setOnline(
    userId: string,
    { productStoreIds, serviceStoreIds }: UserStoreIds,
    isOnline: boolean,
  ) {
    await Promise.all([
      this.userRepo.update({ id: userId }, { isOnline }),
      productStoreIds.length &&
        this.productStoreRepo.update({ id: In(productStoreIds) }, { isOnline }),
      serviceStoreIds.length &&
        this.serviceStoreRepo.update({ id: In(serviceStoreIds) }, { isOnline }),
    ]);
  }

  findOne(id: number) {
    return `This action returns a #${id} chat`;
  }

  // Marks every unread message the receiver got in the conversation as read and
  // returns them
  markAsRead({ conversationId, receiverId }: MarkAsReadDto) {
    return this.messageRepo.manager.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Message)
        .set({ status: MessageStatus.READ })
        .where({
          conversationId,
          receiverId,
          status: In(UNREAD_STATUSES),
        })
        .returning(['id', 'senderId', 'receiverType'])
        .execute();

      const read = result.raw as Pick<
        Message,
        'id' | 'senderId' | 'receiverType'
      >[];

      if (read.length) {
        await this.messageSubscriber.syncUnreadCounts(manager, {
          conversationId,
          receiverId,
          receiverType: read[0].receiverType,
        });
      }

      return read;
    });
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
}
