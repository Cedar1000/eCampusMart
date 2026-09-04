import { Index, Entity, Column } from 'typeorm';

import { Exclude } from 'class-transformer';
import { BaseEntity } from 'src/common/base.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super-admin',
}

@Entity()
export class User extends BaseEntity {
  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  @Index({ unique: true })
  email: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  countryCode: string;

  @Column({ nullable: true })
  campusId: string;

  @Column({ nullable: true })
  photo: string;

  @Column({ select: false, nullable: true })
  @Exclude({ toPlainOnly: true })
  password: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'int', nullable: true, select: false })
  otp: number | null;

  @Column({ default: 0 })
  ratingsCount: number;

  @Column({ nullable: true, type: 'float', default: 0 })
  ratingsAverage: number;

  @Column({ nullable: true })
  lastLoggedIn: Date;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ nullable: true, select: false })
  passwordChangedAt: Date;

  @Column({
    nullable: true,
    select: false,
    type: 'timestamptz',
  })
  passwordResetTokenExpires: Date | null;

  @Column({ nullable: true, select: false, type: 'varchar', length: 255 })
  passwordResetToken: string | null;

  @Column({ nullable: true, select: false, type: 'timestamptz' })
  otpExpiration: Date | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;
}
