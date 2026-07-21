import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    CreateDateColumn, 
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index 
} from 'typeorm';

import { Announcement } from './Announcement';

/**
 * Delivery status for individual server deliveries
 */
export enum DeliveryStatus {
    PENDING = 'pending',
    SCHEDULED = 'scheduled',
    SENDING = 'sending',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

/**
 * Maximum number of retry attempts for failed deliveries
 */
export const MAX_DELIVERY_RETRY_COUNT = 3;

/**
 * AnnouncementDelivery Entity
 * 
 * Tracks delivery status for each Discord server/channel target.
 * Supports multi-server targeting and retry logic for Phase 2.
 */
@Entity('announcement_deliveries')
@Index(['announcementId', 'guildId'])
@Index(['status', 'scheduledAt'])
export class AnnouncementDelivery {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    announcementId!: string;

    @ManyToOne(() => Announcement, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'announcementId' })
    announcement!: Announcement;

    @Column({ type: 'varchar', length: 20 })
    guildId!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    channelId?: string;

    @Column({
        type: 'varchar',
        length: 20,
        default: DeliveryStatus.PENDING
    })
    status!: DeliveryStatus;

    @Column({ type: 'varchar', length: 20, nullable: true })
    messageId?: string;

    @Column({ type: 'int', default: 0 })
    retryCount!: number;

    @Column({ type: 'timestamp', nullable: true })
    scheduledAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    deliveredAt?: Date;

    @Column({ type: 'text', nullable: true })
    errorMessage?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    // Computed properties
    get isPending(): boolean {
        return this.status === DeliveryStatus.PENDING || 
               this.status === DeliveryStatus.SCHEDULED;
    }

    get isDelivered(): boolean {
        return this.status === DeliveryStatus.DELIVERED;
    }

    get isFailed(): boolean {
        return this.status === DeliveryStatus.FAILED;
    }

    get canRetry(): boolean {
        return this.status === DeliveryStatus.FAILED && this.retryCount < MAX_DELIVERY_RETRY_COUNT;
    }
}
