import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';

import type IQuery from 'interfaces/query.Interface';
import { ValidParticipantGuard } from './guards/valid-participant.guard';
import { IncludeMessageListingsInterceptor } from './interceptors/include-message-listings.interceptor';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  create(@Body() createChatDto: CreateChatDto, @CurrentUser() user: User) {
    return this.chatService.create(createChatDto, user.id);
  }

  // Hides the conversation's messages so far, for the current user only
  @Post('conversations/:conversationId/clear')
  @HttpCode(HttpStatus.OK)
  clearConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: User,
  ) {
    return this.chatService.clearConversation(user.id, conversationId);
  }

  // participantId is the current user's id or one of their product/service store ids
  @Get('conversations/:participantId')
  @UseGuards(ValidParticipantGuard)
  findAllConversations(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Query() query: Partial<IQuery>,
  ) {
    query.relations ??= 'lastMessage';
    return this.chatService.findAllConversations(participantId, query);
  }

  // Messages in a conversation the current user (or one of their stores) is in
  @Get('conversations/:conversationId/messages')
  @UseInterceptors(IncludeMessageListingsInterceptor)
  findAllMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: User,
    @Query() query: Partial<IQuery>,
  ) {
    return this.chatService.findAllMessages(user.id, conversationId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatService.remove(+id);
  }
}
