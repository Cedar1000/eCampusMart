import { ArgumentsHost, ForbiddenException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { QueryFailedError } from 'typeorm';

import { ChatGateway, validPayload } from './chat.gateway';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { ChatExceptionFilter } from './filters/chat-exception.filter';

const USER = '11111111-1111-4111-8111-111111111111';
const STORE = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const CONVERSATION = '44444444-4444-4444-8444-444444444444';

const validate = (metatype: new () => object, value: unknown) =>
  validPayload.transform(value, { type: 'body', metatype });

const errorMessage = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as { getResponse(): { message: string[] } }).getResponse()
      .message;
  }
  throw new Error('Expected the payload to be refused');
};

describe('chat payload validation', () => {
  const message = { senderId: USER, receiverId: OTHER, content: 'Hi' };

  it('accepts a valid new-message', async () => {
    await expect(validate(CreateChatDto, message)).resolves.toBeInstanceOf(
      CreateChatDto,
    );
  });

  it('accepts the message type', async () => {
    await expect(
      validate(CreateChatDto, { ...message, type: 'voicenote' }),
    ).resolves.toMatchObject({ type: 'voicenote' });
  });

  it('refuses an unknown message type', async () => {
    expect(
      await errorMessage(validate(CreateChatDto, { ...message, type: 'gif' })),
    ).toEqual([expect.stringContaining('type must be one of')]);
  });

  it('refuses unknown fields', async () => {
    expect(
      await errorMessage(validate(CreateChatDto, { ...message, extra: 1 })),
    ).toEqual(['property extra should not exist']);
  });

  it('refuses a message without content', async () => {
    const { content, ...withoutContent } = message;
    void content;

    expect(
      await errorMessage(validate(CreateChatDto, withoutContent)),
    ).toContain('content should not be empty');
  });

  it('refuses mark-all-as-read without a conversationId', async () => {
    expect(
      await errorMessage(
        validate(MarkAsReadDto, { receiverId: USER, senderId: OTHER }),
      ),
    ).toContain('conversationId must be a UUID');
  });
});

describe('ChatGateway', () => {
  const emit = jest.fn();
  const chatService = {
    markAsRead: jest.fn(),
    create: jest.fn(),
  };
  const redis = { get: jest.fn((key: string) => `socket-of-${key}`) };

  const gateway = new ChatGateway(
    chatService as unknown as ChatService,
    redis as never,
  );
  Object.assign(gateway, { server: { to: () => ({ emit }) } });

  const client = {
    data: {
      userId: USER,
      stores: { productStoreIds: [STORE], serviceStoreIds: [] },
    },
  } as never;

  beforeEach(() => jest.clearAllMocks());

  it('sends mark-all-as-read to the senders of the read messages and the reader', async () => {
    chatService.markAsRead.mockResolvedValue([
      { id: 'm1', senderId: OTHER, receiverType: 'user' },
      { id: 'm2', senderId: OTHER, receiverType: 'user' },
    ]);

    const ids = await gateway.markAllAsRead(
      { conversationId: CONVERSATION, receiverId: USER, senderId: OTHER },
      client,
    );

    expect(ids).toEqual(['m1', 'm2']);
    expect(redis.get.mock.calls.map(([key]) => key).sort()).toEqual(
      [`user-${OTHER}`, `user-${USER}`].sort(),
    );
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith('mark-all-as-read', CONVERSATION);
  });

  it("refuses to mark someone else's messages as read", async () => {
    await expect(
      gateway.markAllAsRead(
        { conversationId: CONVERSATION, receiverId: OTHER, senderId: USER },
        client,
      ),
    ).rejects.toThrow(WsException);
    expect(chatService.markAsRead).not.toHaveBeenCalled();
  });

  it('lets a user type as their own store but not as someone else', async () => {
    const typing = { conversationId: CONVERSATION, receiverId: OTHER };

    await gateway.handleTyping({ ...typing, senderId: STORE }, client);
    expect(emit).toHaveBeenCalledWith('typing', expect.anything());

    await expect(
      gateway.handleTyping(
        { ...typing, senderId: OTHER, receiverId: USER },
        client,
      ),
    ).rejects.toThrow(WsException);
  });

  it('passes the connected user to the service when sending', async () => {
    chatService.create.mockRejectedValue(new ForbiddenException('nope'));

    await expect(
      gateway.handleMessage(
        { senderId: OTHER, receiverId: USER, content: 'Hi' } as CreateChatDto,
        client,
      ),
    ).rejects.toThrow('nope');
    expect(chatService.create).toHaveBeenCalledWith(expect.anything(), USER);
  });
});

describe('ChatExceptionFilter', () => {
  const filter = new ChatExceptionFilter();
  const sent = jest.fn();
  const host = {
    switchToWs: () => ({
      getClient: () => ({ emit: sent }),
      getData: () => ({}),
      getPattern: () => 'new-message',
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getType: () => 'ws',
  } as unknown as ArgumentsHost;

  beforeEach(() => sent.mockClear());

  it('sends HTTP exceptions with their message', () => {
    filter.catch(new ForbiddenException('Not yours'), host);

    expect(sent).toHaveBeenCalledWith(
      'exception',
      expect.objectContaining({ status: 'error', message: 'Not yours' }),
    );
  });

  it('hides database errors', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    filter.catch(
      new QueryFailedError('INSERT ...', [], new Error('violates check')),
      host,
    );

    expect(sent).toHaveBeenCalledWith(
      'exception',
      expect.objectContaining({
        status: 'error',
        message: 'Internal server error',
      }),
    );
  });
});
