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
 * Notification type — determines icon/color on the client.
 */
export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
  ANNOUNCEMENT = 'announcement',
  ACTIVITY_INVITATION = 'activity_invitation',
  ACTIVITY_COMPLETED = 'activity_completed',
  ACTIVITY_CANCELLED = 'activity_cancelled',
  FLEET_CREATED = 'fleet_created',
  FLEET_DEPLOYED = 'fleet_deployed',
  FLEET_DISSOLVED = 'fleet_dissolved',
  TRADE_OPERATION_CREATED = 'trade_operation_created',
  ROUTE_STATUS_CHANGED = 'route_status_changed',
  FEDERATION_INVITATION = 'federation_invitation',
  FEDERATION_ACCEPTED = 'federation_accepted',
}

/**
 * Notification priority — influences sort order and visual prominence.
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Notification entity — persisted in-app notifications for users.
 *
 * Each row represents a single notification delivered to one user.
 * Supports read/unread tracking and optional JSON metadata.
 */
@Entity('notifications')
@Index(['userId', 'read'])
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Recipient user */
  @Column({ type: 'varchar' })
  @Index()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  /** Sender user (null = system notification) */
  @Column({ type: 'varchar', nullable: true })
  senderId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'senderId' })
  sender?: User | null;

  /** Notification category */
  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.INFO })
  type!: NotificationType;

  /** Priority level */
  @Column({ type: 'enum', enum: NotificationPriority, default: NotificationPriority.NORMAL })
  priority!: NotificationPriority;

  /** Short title */
  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** Full message body */
  @Column({ type: 'text' })
  message!: string;

  /** Whether the user has read this notification */
  @Column({ type: 'boolean', default: false })
  read!: boolean;

  /** When the notification was read */
  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  /** Optional structured metadata (resource IDs, action URLs, etc.) */
  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
