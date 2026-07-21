import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AlertType {
    LOW_STOCK = 'low_stock',
    CRITICAL_STOCK = 'critical_stock',
    OUT_OF_STOCK = 'out_of_stock',
    EXPIRING_SOON = 'expiring_soon',
    RESTOCK_DUE = 'restock_due',
    CONSUMPTION_SPIKE = 'consumption_spike',
    SUPPLIER_ISSUE = 'supplier_issue',
    CUSTOM = 'custom'
}

export enum AlertSeverity {
    INFO = 'info',
    WARNING = 'warning',
    CRITICAL = 'critical',
    URGENT = 'urgent'
}

export enum AlertStatus {
    ACTIVE = 'active',
    ACKNOWLEDGED = 'acknowledged',
    RESOLVED = 'resolved',
    DISMISSED = 'dismissed'
}

export enum NotificationChannel {
    IN_APP = 'in_app',
    EMAIL = 'email',
    DISCORD = 'discord',
    WEBHOOK = 'webhook'
}

export interface AlertRecipient {
    userId?: string;
    email?: string;
    discordId?: string;
    webhookUrl?: string;
}

export interface AlertAction {
    actionType: string;
    description: string;
    performedBy?: string;
    performedAt?: Date;
}

@Entity('logistics_alerts')
export class LogisticsAlert {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column()
    fleetId!: string;

    @Index()
    @Column()
    inventoryItemId!: string;

    @Column()
    itemName!: string;

    @Index()
    @Column({
        type: 'varchar'
    })
    type!: AlertType;

    @Column({
        type: 'varchar'
    })
    severity!: AlertSeverity;

    @Index()
    @Column({
        type: 'varchar',
        default: AlertStatus.ACTIVE
    })
    status!: AlertStatus;

    @Column()
    title!: string;

    @Column('text')
    message!: string;

    @Column('simple-json', { nullable: true })
    metadata?: {
        currentQuantity?: number;
        threshold?: number;
        unit?: string;
        category?: string;
        location?: string;
        daysRemaining?: number;
        consumptionRate?: number;
        [key: string]: unknown;
    };

    @Column('simple-json', { default: '[]' })
    recipients!: AlertRecipient[];

    @Column('simple-array', { default: '' })
    notificationChannels!: NotificationChannel[];

    @Column({ default: false })
    notificationSent!: boolean;

    @Column({ nullable: true })
    notificationSentAt?: Date;

    @Column({ nullable: true })
    acknowledgedBy?: string;

    @Column({ nullable: true })
    acknowledgedAt?: Date;

    @Column({ nullable: true })
    resolvedBy?: string;

    @Column({ nullable: true })
    resolvedAt?: Date;

    @Column('text', { nullable: true })
    resolutionNotes?: string;

    @Column('simple-json', { default: '[]' })
    actions!: AlertAction[];

    @Column({ default: 0 })
    repeatCount!: number; // How many times this alert has been triggered

    @Column({ nullable: true })
    lastTriggeredAt?: Date;

    @Column({ nullable: true })
    expiresAt?: Date;

    @Column({ default: true })
    autoResolve!: boolean; // Auto-resolve when conditions no longer met

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

// DTOs
export interface CreateAlertDto {
    fleetId: string;
    inventoryItemId: string;
    itemName: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    recipients: AlertRecipient[];
    notificationChannels: NotificationChannel[];
    expiresAt?: Date;
    autoResolve?: boolean;
}

export interface UpdateAlertDto {
    status?: AlertStatus;
    acknowledgedBy?: string;
    resolvedBy?: string;
    resolutionNotes?: string;
}

export interface AlertFilterOptions {
    fleetId?: string;
    inventoryItemId?: string;
    type?: AlertType | AlertType[];
    severity?: AlertSeverity | AlertSeverity[];
    status?: AlertStatus | AlertStatus[];
    unacknowledgedOnly?: boolean;
    activeOnly?: boolean;
}

export interface AlertConfiguration {
    enabled: boolean;
    type: AlertType;
    threshold?: number;
    recipients: AlertRecipient[];
    channels: NotificationChannel[];
    repeatInterval?: number; // Minutes between repeat notifications
    maxRepeats?: number;
    autoResolve?: boolean;
}
