import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Reminder types for different notification triggers
 */
export enum ReminderType {
    ONE_DAY_BEFORE = '1_day_before',
    ONE_HOUR_BEFORE = '1_hour_before',
    THIRTY_MINUTES_BEFORE = '30_min_before',
    CUSTOM = 'custom'
}

/**
 * Delivery channels for sending reminders
 */
export enum ReminderChannel {
    DISCORD = 'discord',
    EMAIL = 'email',
    BOTH = 'both'
}

/**
 * Delivery status tracking
 */
export enum DeliveryStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

/**
 * Activity reminder tracking
 * Manages automated reminders for activities (events, operations, etc.)
 * 
 * Migrated from EventReminder as part of Activity domain consolidation (v3.0.0)
 */
@Entity('activity_reminders')
@Index(['activityId', 'scheduledTime'])
@Index(['deliveryStatus', 'scheduledTime'])
export class ActivityReminder {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column()
    activityId!: string;

    @Column({
        type: 'varchar',
        enum: ReminderType
    })
    reminderType!: ReminderType;

    @Column({
        type: 'varchar',
        enum: ReminderChannel,
        default: ReminderChannel.DISCORD
    })
    channel!: ReminderChannel;

    @Index()
    @Column()
    scheduledTime!: Date;

    @Column({
        type: 'varchar',
        enum: DeliveryStatus,
        default: DeliveryStatus.PENDING
    })
    deliveryStatus!: DeliveryStatus;

    // Recipients
    @Column('simple-array', { nullable: true })
    recipientUserIds?: string[];

    @Column('simple-array', { nullable: true })
    recipientEmails?: string[];

    @Column({ nullable: true })
    discordChannelId?: string;

    // Message content
    @Column({ type: 'text' })
    messageTemplate!: string;

    @Column({ type: 'simple-json', nullable: true })
    messageVariables?: {
        eventTitle?: string;
        eventDate?: string;
        eventLocation?: string;
        timeUntil?: string;
        [key: string]: unknown;
    };

    // Delivery tracking
    @Column({ nullable: true })
    sentAt?: Date;

    @Column({ type: 'text', nullable: true })
    errorMessage?: string;

    @Column({ default: 0 })
    retryCount!: number;

    @Column({ nullable: true })
    lastRetryAt?: Date;

    // Configuration
    @Column({ default: true })
    isEnabled!: boolean;

    @Column({ nullable: true })
    createdBy?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    /**
     * Check if reminder is due
     */
    isDue(): boolean {
        return this.scheduledTime <= new Date() && 
               this.deliveryStatus === DeliveryStatus.PENDING &&
               this.isEnabled;
    }

    /**
     * Check if can retry
     */
    canRetry(): boolean {
        return this.retryCount < 3 && 
               this.deliveryStatus === DeliveryStatus.FAILED;
    }

    /**
     * Get formatted message
     */
    getFormattedMessage(): string {
        let message = this.messageTemplate;
        
        if (this.messageVariables) {
            Object.entries(this.messageVariables).forEach(([key, value]) => {
                message = message.replace(`{{${key}}}`, String(value));
            });
        }
        
        return message;
    }
}
