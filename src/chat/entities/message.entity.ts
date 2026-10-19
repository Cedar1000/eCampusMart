import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';
import { Conversation } from './conversation.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  SYSTEM = 'system',
  VOICENOTE = 'voicenote',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export interface MessageMedia {
  url: string;
  thumbnail?: string;
  size?: number;
  duration?: number; // For audio/video/voicenote
  mimeType?: string;
  type?: string; // image, video, audio, file, voicenote,
}

export interface MessageMetadata {
  editedAt?: string;
  deletedAt?: string;
  forwardedFrom?: string;
}

export enum MessageIndentity {
  USER = 'user',
  PRODUCT_STORE = 'product-store',
  SERVICE_STORE = 'service-store',
}

@Entity()
@Index(['conversationId', 'createdAt'])
// Text messages need content; media messages may leave it out. Compares as text so
// the check doesn't reference the enum type, which TypeORM recreates when values change
@Check(`"type"::text <> 'text' OR "content" IS NOT NULL`)
export class Message extends BaseEntity {
  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation?: Conversation;

  @Index()
  @Column()
  senderId: string;

  @Column({ type: 'enum', enum: MessageIndentity })
  senderType: MessageIndentity;

  @Column({ type: 'enum', enum: MessageIndentity })
  receiverType: MessageIndentity;

  @Column()
  receiverId: string;

  @Column({ nullable: true })
  productId?: string;

  @Column({ nullable: true })
  serviceId?: string;

  @Column({ nullable: true })
  housingId?: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  media?: MessageMedia[] | null;

  @Index()
  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  @Column({ type: 'uuid', nullable: true, default: null })
  replyToId?: string | null;

  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replyToId' })
  replyTo?: Message | null;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ type: 'jsonb', nullable: true, default: null })
  metadata?: MessageMetadata | null;
}
