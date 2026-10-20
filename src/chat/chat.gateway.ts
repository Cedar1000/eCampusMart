import { Inject, UseFilters, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';

import { Socket, Server } from 'socket.io';
import Redis from 'ioredis';

import { REDIS_CLIENT } from 'src/redis/constants/redis.constant';
import {
  ChatService,
  UserStoreIds,
  onlineIdsOf as onlineIds,
} from './chat.service';
import { ChatExceptionFilter } from './filters/chat-exception.filter';
import { CreateChatDto } from './dto/create-chat.dto';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { TypingDto } from './dto/typing.dto';
import { RecordingDto } from './dto/recording.dto';
import { Message, MessageStatus } from './entities/message.entity';

interface ChatSocketData {
  userId?: string;
  stores?: UserStoreIds;
}

type ChatSocket = Socket<any, any, any, ChatSocketData>;

const onlineUserKey = (userId: string) => `user-${userId}`;

// The global ValidationPipe only covers HTTP, so gateways need their own. It goes on
// @MessageBody only: a class-level pipe would also run on the @ConnectedSocket param
export const validPayload = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

@UseFilters(ChatExceptionFilter)
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly chatService: ChatService,

    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  async handleConnection(client: ChatSocket) {
    try {
      console.log(`Client connected: ${client.id}`);

      // TODO: authenticate the socket instead of trusting the userid header
      const { userid } = client.handshake.headers;

      if (typeof userid !== 'string' || !userid) {
        console.log('No userid provided, disconnecting client');
        client.disconnect(true);
        return;
      }

      const stores = await this.chatService.findUserStoreIds(userid);

      console.log({ stores });

      if (!stores) {
        console.log('User not found, disconnecting client');
        client.disconnect(true);
        return;
      }

      client.data.userId = userid;
      client.data.stores = stores;

      // Stores get the same key as users so emitToUser reaches messages sent to a store
      const pipeline = this.redisClient.pipeline();
      onlineIds(userid, stores).forEach((id) =>
        pipeline.set(onlineUserKey(id), client.id),
      );
      await pipeline.exec();

      await this.chatService.setOnline(userid, stores, true);

      // Messages sent while they were offline have now reached them
      const delivered = await this.chatService.markDelivered(
        onlineIds(userid, stores),
      );
      await this.notifyDelivered(delivered);

      console.log(`Online user stored successfully: ${userid} -> ${client.id}`);
    } catch (error) {
      console.error('Connection setup failed:', error);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: ChatSocket) {
    try {
      console.log(`Client disconnected: ${client.id}`);

      const { userId, stores } = client.data;

      if (!userId || !stores) return;

      // The user may have reconnected on a new socket already; keep that one
      if ((await this.redisClient.get(onlineUserKey(userId))) !== client.id) {
        return;
      }

      await this.redisClient.del(
        ...onlineIds(userId, stores).map(onlineUserKey),
      );
      await this.chatService.setOnline(userId, stores, false);

      console.log(`Online user removed successfully: ${userId}`);
    } catch (error) {
      console.error('Disconnect cleanup failed:', error);
    }
  }

  @SubscribeMessage('new-message')
  async handleMessage(
    @MessageBody(validPayload) createChatDto: CreateChatDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const message = await this.chatService.create(
      createChatDto,
      this.connectedUserId(client),
    );

    const isOnline = await this.emitToUser(
      message.receiverId,
      'new-message',
      message,
    );

    if (isOnline) {
      const delivered = await this.chatService.markDelivered(
        [message.receiverId],
        [message.id],
      );

      if (delivered.length) message.status = MessageStatus.DELIVERED;

      await this.notifyDelivered(delivered);
    }

    return message;
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody(validPayload) typingDto: TypingDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    this.assertOwnId(client, typingDto.senderId);
    await this.emitToUser(typingDto.receiverId, 'typing', typingDto);
  }

  @SubscribeMessage('stop-typing')
  async handleStopTyping(
    @MessageBody(validPayload) typingDto: TypingDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    this.assertOwnId(client, typingDto.senderId);
    await this.emitToUser(typingDto.receiverId, 'stop-typing', typingDto);
  }

  @SubscribeMessage('recording')
  async handleRecording(
    @MessageBody(validPayload) recordingDto: RecordingDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    this.assertOwnId(client, recordingDto.senderId);
    await this.emitToUser(recordingDto.receiverId, 'recording', recordingDto);
  }

  @SubscribeMessage('stop-recording')
  async handleStopRecording(
    @MessageBody(validPayload) recordingDto: RecordingDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    this.assertOwnId(client, recordingDto.senderId);
    await this.emitToUser(
      recordingDto.receiverId,
      'stop-recording',
      recordingDto,
    );
  }

  @SubscribeMessage('remove-chat')
  remove(@MessageBody() id: number) {
    return this.chatService.remove(id);
  }

  @SubscribeMessage('mark-all-as-read')
  async markAllAsRead(
    @MessageBody(validPayload) markAsReadDto: MarkAsReadDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    const { conversationId, receiverId } = markAsReadDto;

    console.log('before asserting', receiverId);
    // Only the reader can mark their own messages as read
    // this.assertOwnId(client, receiverId);

    console.log('after asserting');
    await this.emitToUser(receiverId, 'mark-all-as-read', { conversationId });

    // const read = await this.chatService.markAsRead(markAsReadDto);

    // if (read.length) {
    //   // The senders of the read messages, so their ticks turn blue, and the reader
    //   const notify = new Set([
    //     ...read.map(({ senderId }) => senderId),
    //     receiverId,
    //   ]);

    //   await Promise.all(
    //     [...notify].map((id) =>
    //       this.emitToUser(id, 'mark-all-as-read', conversationId),
    //     ),
    //   );
    // }

    // return read.map(({ id }) => id);
  }

  private connectedUserId(client: ChatSocket) {
    const { userId } = client.data;

    if (!userId) throw new WsException('Not connected as a user');

    return userId;
  }

  // Throws unless id is the connected user or one of their stores
  private assertOwnId(client: ChatSocket, id: string) {
    const { userId, stores } = client.data;

    if (!userId || !stores || !onlineIds(userId, stores).includes(id)) {
      throw new WsException(
        'You can only act as yourself or one of your stores',
      );
    }
  }

  // Returns whether the user was online to receive it
  private async emitToUser(userId: string, event: string, data: unknown) {
    console.log(`Emitting event "${event}" to user ${userId}:`, data);
    const clientId = await this.redisClient.get(onlineUserKey(userId));

    if (!clientId) return false;

    this.server.to(clientId).emit(event, data);
    return true;
  }

  // Tells each sender which of their messages were delivered, per conversation
  private async notifyDelivered(
    messages: Pick<Message, 'id' | 'senderId' | 'conversationId'>[],
  ) {
    const groups = new Map<
      string,
      { senderId: string; conversationId: string; messageIds: string[] }
    >();

    messages.forEach(({ id, senderId, conversationId }) => {
      const key = `${senderId}:${conversationId}`;
      const group = groups.get(key) ?? {
        senderId,
        conversationId,
        messageIds: [],
      };

      group.messageIds.push(id);
      groups.set(key, group);
    });

    await Promise.all(
      [...groups.values()].map(({ senderId, conversationId, messageIds }) =>
        this.emitToUser(senderId, 'message-delivered', {
          conversationId,
          messageIds,
        }),
      ),
    );
  }
}
