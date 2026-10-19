import { IsNotEmpty, IsUUID } from 'class-validator';

export class MarkAsReadDto {
  @IsNotEmpty()
  @IsUUID()
  conversationId: string;

  // The user (or store) who read the messages
  @IsNotEmpty()
  @IsUUID()
  receiverId: string;

  // The other participant, told their messages were read
  @IsNotEmpty()
  @IsUUID()
  senderId: string;
}
