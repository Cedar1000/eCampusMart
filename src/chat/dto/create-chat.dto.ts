import {
  IsArray,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageIndentity, MessageType } from '../entities/message.entity';

class ChatMediaDto {
  @IsNotEmpty()
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class CreateChatDto {
  @IsOptional()
  @IsUUID()
  conversationId: string;

  @IsNotEmpty()
  @IsUUID()
  senderId: string;

  @IsOptional()
  @IsEnum(MessageIndentity)
  senderType: MessageIndentity;

  @IsOptional()
  @IsEnum(MessageIndentity)
  receiverType: MessageIndentity;

  @IsNotEmpty()
  @IsUUID()
  receiverId: string;

  @IsOptional()
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsUUID()
  housingId: string;

  // Saved as text when left out
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  // The database requires content on text messages
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMediaDto)
  media?: ChatMediaDto[];
}
