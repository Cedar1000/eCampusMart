import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from 'src/common/base.entity';

export enum PushPlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

// An Expo push token for one of a user's phones. A phone has one token, so it
// moves to whoever signs in on it
@Entity('push_token')
export class PushToken extends BaseEntity {
  @Column({ unique: true })
  token: string;

  @Index()
  @Column()
  userId: string;

  @Column({ type: 'enum', enum: PushPlatform })
  platform: PushPlatform;
}
