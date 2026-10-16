import { IsMongoId, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class MarkAsReadDto {
  @IsOptional()
  @IsMongoId()
  conversationId: string;

  @IsNotEmpty()
  @IsUUID()
  receiverId: string;

  @IsNotEmpty()
  @IsUUID()
  senderId: string;
}
