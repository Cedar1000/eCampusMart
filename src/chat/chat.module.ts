import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { MessageSubscriber } from './entities/message.subscriber';
import { User } from 'src/auth/entities/user.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { Product } from 'src/product/entities/product.entity';
import { Service } from 'src/service/entities/service.entity';
import { Housing } from 'src/housing/entities/housing.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      Message,
      User,
      ProductStore,
      ServiceStore,
      Product,
      Service,
      Housing,
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, MessageSubscriber],
})
export class ChatModule {}
