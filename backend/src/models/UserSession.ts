import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Classified, DataClassification } from '../utils/dataClassification';
import { conditionalEncryptionTransformer } from '../utils/encryptionTransformer';

import { User } from './User';

/**
 * UserSession Model
 * Tracks active user sessions with Discord OAuth tokens
 */
@Entity('user_sessions')
@Index(['userId', 'isActive'])
@Index(['sessionToken'])
@Index(['expiresAt'])
export class UserSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Classified(DataClassification.RESTRICTED, { reason: 'Session identifier' })
  @Column({ unique: true })
  sessionToken: string;

  @Classified(DataClassification.RESTRICTED, { reason: 'OAuth access token' })
  @Column({
    type: 'text',
    transformer: conditionalEncryptionTransformer,
  })
  discordAccessToken: string;

  @Classified(DataClassification.RESTRICTED, { reason: 'OAuth refresh token' })
  @Column({
    type: 'text',
    transformer: conditionalEncryptionTransformer,
  })
  discordRefreshToken: string;

  @Column()
  discordTokenExpiry: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  lastActivity: Date;

  @Column()
  expiresAt: Date;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client IP address' })
  @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
  ipAddress?: string;

  @Classified(DataClassification.CONFIDENTIAL, { reason: 'Client device info' })
  @Column({ nullable: true, type: 'text', transformer: conditionalEncryptionTransformer })
  userAgent?: string;
}
