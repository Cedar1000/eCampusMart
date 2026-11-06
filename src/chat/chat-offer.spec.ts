import { BadRequestException, NotFoundException } from '@nestjs/common';

import { Offer, OfferSellerType } from 'src/offer/entities/offer.entity';
import { Product } from 'src/product/entities/product.entity';
import { ProductStatus } from 'src/product/enums/product-status.enum';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { Message, MessageType } from './entities/message.entity';

const BUYER = 'buyer-1';
const SELLER = 'seller-1';
const STORE = 'store-1';

describe('ChatService offers', () => {
  let product: Partial<Product> | null;
  let saved: { entity: unknown; row: Record<string, unknown> }[];
  let service: ChatService;

  // The seller, connected as themselves, makes an offer to the buyer
  const send = (fields: Partial<CreateChatDto> = {}, connectedAs = SELLER) =>
    service.create(
      {
        senderId: SELLER,
        receiverId: BUYER,
        conversationId: 'conversation-1',
        type: MessageType.OFFER,
        productId: 'product-1',
        amount: 5000.5,
        ...fields,
      } as CreateChatDto,
      connectedAs,
    );

  const savedOffer = () => saved.find(({ entity }) => entity === Offer)?.row;

  beforeEach(() => {
    saved = [];
    product = {
      id: 'product-1',
      userId: SELLER,
      isStoreProduct: false,
      status: ProductStatus.ACTIVE,
    };

    const manager = {
      findOne: jest.fn(() => product),
      create: jest.fn((entity: unknown, row: Record<string, unknown>) => ({
        entity,
        row,
      })),
      save: jest.fn(
        ({
          entity,
          row,
        }: {
          entity: unknown;
          row: Record<string, unknown>;
        }) => {
          saved.push({ entity, row });
          return { id: entity === Offer ? 'offer-1' : 'message-1', ...row };
        },
      ),
      transaction: jest.fn((run: (m: unknown) => unknown): unknown =>
        run(manager),
      ),
    };

    service = new ChatService(
      { exists: jest.fn(() => true) } as never,
      { manager } as never,
      {
        find: jest.fn(() => [{ id: SELLER }, { id: BUYER }]),
        findOne: jest.fn(() => ({ id: SELLER })),
      } as never,
      { find: jest.fn(() => []) } as never,
      { find: jest.fn(() => [{ id: STORE }]) } as never,
      {} as never,
      {} as never,
    );
  });

  it('creates the offer with the sender as seller and returns it, in naira', async () => {
    const message = await send();

    expect(savedOffer()).toMatchObject({
      sellerId: SELLER,
      buyerId: BUYER,
      sellerType: OfferSellerType.USER,
      productId: 'product-1',
      amount: 500050,
    });
    expect(
      saved.find(({ entity }) => entity === Message)?.row,
    ).not.toHaveProperty('amount');
    expect(message).toMatchObject({
      offerId: 'offer-1',
      type: MessageType.OFFER,
      offer: { id: 'offer-1', amount: 5000.5, sellerId: SELLER },
    });
  });

  it('lets a store make an offer on its own product', async () => {
    Object.assign(product!, { isStoreProduct: true, storeId: STORE });

    await send({ senderId: STORE });

    expect(savedOffer()).toMatchObject({
      sellerId: STORE,
      buyerId: BUYER,
      sellerType: OfferSellerType.SERVICE_STORE,
    });
  });

  it('refuses a product that does not exist', async () => {
    product = null;

    await expect(send()).rejects.toThrow(NotFoundException);
    expect(saved).toHaveLength(0);
  });

  it.each([
    ['is not for sale', () => (product!.status = ProductStatus.SOLD)],
    ['belongs to someone else', () => (product!.userId = 'someone-else')],
    [
      "belongs to the sender's store, when sent as the user",
      () => Object.assign(product!, { isStoreProduct: true, storeId: STORE }),
    ],
  ])('refuses a product that %s', async (_case, arrange) => {
    arrange();

    await expect(send()).rejects.toThrow(BadRequestException);
    expect(saved).toHaveLength(0);
  });

  it('refuses a buyer making an offer to the seller', async () => {
    await expect(
      send({ senderId: BUYER, receiverId: SELLER }, BUYER),
    ).rejects.toThrow(BadRequestException);
    expect(saved).toHaveLength(0);
  });
});
