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

  describe('offers', () => {
    const offer = {
      senderId: USER,
      receiverId: OTHER,
      type: 'offer',
      productId: CONVERSATION,
      amount: 5000,
    };

    it('accepts an offer without content', async () => {
      await expect(validate(CreateChatDto, offer)).resolves.toMatchObject({
        amount: 5000,
      });
    });

    it.each([
      ['amount', 'amount must be a positive number'],
      ['productId', 'productId must be a UUID'],
    ])('refuses an offer without %s', async (field, error) => {
      const { [field as 'amount']: _removed, ...rest } = offer;
      void _removed;

      expect(await errorMessage(validate(CreateChatDto, rest))).toContain(
        error,
      );
    });

    it('still requires content on other messages', async () => {
      expect(
        await errorMessage(
          validate(CreateChatDto, { senderId: USER, receiverId: OTHER }),
        ),
      ).toContain('content should not be empty');
    });
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
    markDelivered: jest.fn(() => []),
    pushOffline: jest.fn(),
    findSender: jest.fn((id: string) => ({
      id,
      type: 'user',
      name: 'Ada Obi',
      photo: 'https://res.cloudinary.com/ada.png',
    })),
  };
  const redis = { get: jest.fn((key: string) => `socket-of-${key}`) };

  // Adds a product summary to messages about a product, like the real lookup
  const listings = {
    attach: jest.fn((messages: { productId?: string }[]) =>
      Promise.resolve(
        messages.map((m) =>
          m.productId
            ? { ...m, product: { id: m.productId, name: 'iphone 12' } }
            : m,
        ),
      ),
    ),
  };
  const gateway = new ChatGateway(
    chatService as unknown as ChatService,
    redis as never,
    listings as never,
  );
  Object.assign(gateway, { server: { to: () => ({ emit }) } });

  const client = {
    data: {
      userId: USER,
      stores: { productStoreIds: [STORE], serviceStoreIds: [] },
    },
  } as never;

  beforeEach(() => jest.clearAllMocks());

  it('tells the other participant and marks the reader’s messages read', async () => {
    const dto = {
      conversationId: CONVERSATION,
      senderId: USER,
      receiverId: OTHER,
    };

    await gateway.markAllAsRead(dto, client);

    expect(redis.get).toHaveBeenCalledWith(`user-${OTHER}`);
    expect(emit).toHaveBeenCalledWith('mark-all-as-read', {
      conversationId: CONVERSATION,
    });
    expect(chatService.markAsRead).toHaveBeenCalledWith(dto);
  });

  it('lets a user mark a chat read as their own store', async () => {
    await gateway.markAllAsRead(
      { conversationId: CONVERSATION, senderId: STORE, receiverId: OTHER },
      client,
    );

    expect(chatService.markAsRead).toHaveBeenCalled();
  });

  it('refuses to mark a chat read as someone else, and tells nobody', async () => {
    await expect(
      gateway.markAllAsRead(
        { conversationId: CONVERSATION, senderId: OTHER, receiverId: USER },
        client,
      ),
    ).rejects.toThrow(WsException);
    expect(chatService.markAsRead).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
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

  describe('push to an offline receiver', () => {
    const message = {
      id: 'message-1',
      senderId: USER,
      receiverId: OTHER,
      conversationId: CONVERSATION,
      content: 'Hi',
    };
    const send = () =>
      gateway.handleMessage(
        { senderId: USER, receiverId: OTHER, content: 'Hi' } as CreateChatDto,
        client,
      );

    beforeEach(() => chatService.create.mockResolvedValue({ ...message }));

    it('pushes the message when the receiver is offline', async () => {
      redis.get.mockResolvedValueOnce(null as never);

      await send();

      expect(chatService.pushOffline).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'message-1' }),
      );
    });

    it("doesn't push to a receiver who's online", async () => {
      await send();

      expect(chatService.pushOffline).not.toHaveBeenCalled();
    });

    it('sends the listing summary to the receiver and in the ack', async () => {
      chatService.create.mockResolvedValue({
        ...message,
        productId: 'product-1',
      });

      const ack = await send();

      const withProduct = expect.objectContaining({
        product: { id: 'product-1', name: 'iphone 12' },
      }) as object;
      expect(emit).toHaveBeenCalledWith('new-message', withProduct);
      expect(ack).toEqual(withProduct);
    });

    it("sends the sender's name and photo to the receiver and in the ack", async () => {
      const ack = await send();

      const withSender = expect.objectContaining({
        sender: {
          id: USER,
          type: 'user',
          name: 'Ada Obi',
          photo: 'https://res.cloudinary.com/ada.png',
        },
      }) as object;
      expect(chatService.findSender).toHaveBeenCalledWith(USER);
      expect(emit).toHaveBeenCalledWith('new-message', withSender);
      expect(ack).toEqual(withSender);
    });
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
