import { IsNotEmpty, IsUUID } from 'class-validator';

// Sent while the sender records a voice note, so the receiver can show it
export class RecordingDto {
  @IsNotEmpty()
  @IsUUID()
  conversationId: string;

  @IsNotEmpty()
  @IsUUID()
  senderId: string;

  @IsNotEmpty()
  @IsUUID()
  receiverId: string;
}
