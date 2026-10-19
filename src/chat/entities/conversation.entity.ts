import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';
import { Message } from './message.entity';

export enum ConversationType {
  PRIVATE = 'private',
  GROUP = 'group',
}

@Entity()
@Index(['updatedAt'])
export class Conversation extends BaseEntity {
  @Column({
    type: 'enum',
    enum: ConversationType,
    default: ConversationType.PRIVATE,
  })
  type: ConversationType;

  // Query with ANY / @>, e.g. :userId = ANY(conversation.participants)
  @Index()
  @Column({ type: 'text', array: true })
  participants: string[];

  @Column({ nullable: true })
  createdBy?: string;

  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lastMessageId' })
  lastMessage?: Message | null;

  @Column({ default: false })
  isArchived: boolean;

  // Participant id -> number of unread messages; kept up to date by MessageSubscriber
  @Column({ type: 'jsonb', default: () => "'{}'" })
  unReadCount: Record<string, number>;

  // Participant id -> muted
  @Column({ type: 'jsonb', default: () => "'{}'" })
  mutedBy: Record<string, boolean>;

  // Participant id -> ISO date the mute ends
  @Column({ type: 'jsonb', default: () => "'{}'" })
  mutedUntil: Record<string, string>;
}
