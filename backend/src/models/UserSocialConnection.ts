import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from './User';

/**
 * Type of social connection between two users.
 * Currently only FRIEND is exposed via the API; additional types are reserved
 * for future follower/block features so the same table can host them.
 */
export enum UserSocialConnectionType {
  FRIEND = 'friend',
  FOLLOWER = 'follower',
  BLOCKED = 'blocked',
}

/**
 * Status of a connection within its lifecycle.
 */
export enum UserSocialConnectionStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

/**
 * UserSocialConnection — directional relationship between two users.
 *
 * For symmetric relationships (FRIEND), the application creates ONE row from the
 * requester to the target with `pending` status, then transitions to `accepted`
 * on acceptance. Reciprocity is derived in queries (no second row).
 */
@Entity('user_social_connections')
@Index(['userId', 'targetUserId', 'connectionType'], { unique: true })
@Index(['targetUserId', 'connectionType', 'status'])
@Index(['userId', 'connectionType', 'status'])
export class UserSocialConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User who initiated the connection (the requester). */
  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  /** User on the receiving end of the connection. */
  @Column({ type: 'varchar', length: 255 })
  targetUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetUserId' })
  targetUser!: User;

  @Column({ type: 'varchar', length: 32, default: UserSocialConnectionType.FRIEND })
  connectionType!: UserSocialConnectionType;

  @Column({ type: 'varchar', length: 16, default: UserSocialConnectionStatus.PENDING })
  status!: UserSocialConnectionStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
