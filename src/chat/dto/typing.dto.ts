import { IsMongoId, IsNotEmpty, IsUUID } from 'class-validator';

export class TypingDto {
  @IsNotEmpty()
  @IsMongoId()
  conversationId: string;

  @IsNotEmpty()
  @IsUUID()
  senderId: string;

  @IsNotEmpty()
  @IsUUID()
  receiverId: string;
}
