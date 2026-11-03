import {
  IsArray,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsPositive,
  Max,
  ValidateIf,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageIndentity, MessageType } from '../entities/message.entity';

const isOffer = (dto: CreateChatDto) => dto.type === MessageType.OFFER;

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

  // Required on offers: the product the offer is for
  @ValidateIf((dto: CreateChatDto) => isOffer(dto) || dto.productId != null)
  @IsNotEmpty()
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

  // The database requires content on text messages; optional on offers
  @ValidateIf((dto: CreateChatDto) => !isOffer(dto) || dto.content != null)
  @IsNotEmpty()
  @IsString()
  content?: string;

  // Required on offers: the price offered, in naira. Saved on the offer in kobo, whose
  // int column tops out just above this
  @ValidateIf(isOffer)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(21_000_000)
  amount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMediaDto)
  media?: ChatMediaDto[];
}
