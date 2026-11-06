import { ChatService } from './chat.service';
import { Message, MessageIndentity } from './entities/message.entity';

describe('ChatService.pushOffline', () => {
  const push = { send: jest.fn() };
  const users = {
    find: jest.fn(() => [
      { id: 'sender-1', firstName: 'Ada', lastName: 'Obi' },
    ]),
  };
  const productStores = {
    find: jest.fn(() => [] as { id: string; name: string }[]),
    findOne: jest.fn(() => ({ id: 'store-1', userId: 'owner-1' })),
  };
  const serviceStores = {
    find: jest.fn(() => []),
    findOne: jest.fn(() => ({ id: 'store-2', ownerId: 'owner-2' })),
  };

  const service = new ChatService(
    {} as never,
    {} as never,
    users as never,
    productStores as never,
    serviceStores as never,
    {} as never,
    push as never,
    {} as never,
  );

  const message = (fields: Partial<Message> = {}) =>
    ({
      id: 'message-1',
      senderId: 'sender-1',
      receiverId: 'receiver-1',
      receiverType: MessageIndentity.USER,
      conversationId: 'conversation-1',
      content: 'Is this still available?',
      ...fields,
    }) as Message;

  beforeEach(() => jest.clearAllMocks());

  it("pushes the message with the sender's name and opens its chat", async () => {
    await service.pushOffline(message());

    expect(push.send).toHaveBeenCalledWith(['receiver-1'], {
      title: 'Ada Obi',
      body: 'Is this still available?',
      data: {
        type: 'chat-message',
        conversationId: 'conversation-1',
        receiverId: 'receiver-1',
        messageId: 'message-1',
      },
    });
  });

  it.each([
    [MessageIndentity.PRODUCT_STORE, 'store-1', 'owner-1'],
    [MessageIndentity.SERVICE_STORE, 'store-2', 'owner-2'],
  ])(
    'pushes a message sent to a %s to its owner, keeping the store as receiver',
    async (receiverType, receiverId, owner) => {
      await service.pushOffline(message({ receiverType, receiverId }));

      expect(push.send).toHaveBeenCalledWith(
        [owner],
        expect.objectContaining({
          data: expect.objectContaining({ receiverId }) as object,
        }),
      );
    },
  );

  it("uses the store's name when the sender is a store", async () => {
    users.find.mockReturnValueOnce([]);
    productStores.find.mockReturnValueOnce([
      { id: 'sender-1', name: 'Grace Drinks' },
    ]);

    await service.pushOffline(message());

    expect(push.send).toHaveBeenCalledWith(
      ['receiver-1'],
      expect.objectContaining({ title: 'Grace Drinks' }),
    );
  });

  it('trims a long message to about 150 characters', async () => {
    await service.pushOffline(message({ content: 'a'.repeat(400) }));

    const [, { body }] = push.send.mock.calls[0] as [unknown, { body: string }];
    expect(body).toHaveLength(150);
    expect(body.endsWith('…')).toBe(true);
  });

  it('describes an offer sent without a note, in naira', async () => {
    await service.pushOffline({
      ...message({ content: null as never }),
      offer: { amount: 5000 },
    });

    expect(push.send).toHaveBeenCalledWith(
      ['receiver-1'],
      expect.objectContaining({ body: 'Made an offer: ₦5,000' }),
    );
  });

  it("doesn't throw when the push fails", async () => {
    push.send.mockRejectedValueOnce(new Error('expo down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.pushOffline(message())).resolves.toBeUndefined();
  });

  it('skips a store that no longer exists', async () => {
    productStores.findOne.mockReturnValueOnce(null as never);

    await service.pushOffline(
      message({ receiverType: MessageIndentity.PRODUCT_STORE }),
    );

    expect(push.send).not.toHaveBeenCalled();
  });
});
