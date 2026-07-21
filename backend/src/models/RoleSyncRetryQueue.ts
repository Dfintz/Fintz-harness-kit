import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Role sync retry queue status
 */
export enum RoleSyncRetryStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DEAD_LETTER = 'dead_letter', // Permanently failed after max retries
}

/**
 * Role sync operation type
 */
export enum RoleSyncOperationType {
  ASSIGN = 'assign',
  REMOVE = 'remove',
}

/**
 * Payload structure for role sync retry
 */
export interface RoleSyncRetryPayload {
  guildId: string;
  userId: string;
  roleId: string;
  operation: RoleSyncOperationType;
  retryCount: number;
  originalRequestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * RoleSyncRetryQueue entity for reliable role synchronization
 *
 * Stores failed role sync operations for retry with exponential backoff
 * Ensures role operations survive application restarts and handle transient failures
 */
@Entity('role_sync_retry_queue')
@Index(['status', 'nextRetryAt'])
@Index(['guildId', 'status'])
@Index(['userId', 'status'])
export class RoleSyncRetryQueue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  guildId!: string;

  @Column()
  @Index()
  userId!: string;

  @Column()
  roleId!: string;

  @Column({
    type: 'varchar',
    length: 10,
  })
  operation!: RoleSyncOperationType;

  @Column('simple-json')
  payload!: RoleSyncRetryPayload;

  @Column({ default: 0 })
  retryCount!: number;

  @Column({ default: 3 })
  maxRetries!: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: RoleSyncRetryStatus.PENDING,
  })
  status!: RoleSyncRetryStatus;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  nextRetryAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ nullable: true })
  lastErrorCode?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deadLetteredAt?: Date;

  // Track which admin was notified about persistent failures
  @Column({ type: 'boolean', default: false })
  adminNotified!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  adminNotifiedAt?: Date;
}

/**
 * DTO for creating a retry queue entry
 */
export interface CreateRoleSyncRetryDto {
  guildId: string;
  userId: string;
  roleId: string;
  operation: RoleSyncOperationType;
  maxRetries?: number;
  retryDelayMs?: number;
  originalRequestId?: string;
  metadata?: Record<string, unknown>;
}
