import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export const INCIDENT_STATUSES = ['INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'RESOLVED'] as const;
export type IncidentStatus = typeof INCIDENT_STATUSES[number];

@Entity('data_breach_notifications')
export class DataBreachNotification {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column('varchar')
    title!: string;

    @Column('text')
    description!: string;

    @Column('enum', {
        enum: ['critical', 'high', 'medium', 'low'],
        default: 'medium'
    })
    severity!: 'critical' | 'high' | 'medium' | 'low';

    @Column('simple-array')
    affectedUsers!: string[]; // User IDs

    @Column('simple-array')
    affectedDataTypes!: string[]; // ['PASSWORD', 'EMAIL', 'PAYMENT', etc.]

    @Column('enum', {
        enum: INCIDENT_STATUSES,
        default: 'INVESTIGATING'
    })
    status!: IncidentStatus;

    @CreateDateColumn()
    discoveredAt!: Date;

    @Column('timestamp', { nullable: true })
    containedAt?: Date;

    @Column('timestamp', { nullable: true })
    notifiedAt?: Date;

    @Column('timestamp', { nullable: true })
    resolvedAt?: Date;

    @Column('simple-json', { default: '[]' })
    notifiedUsers!: Array<{
        userId: string;
        notifiedAt: Date;
        status: 'SENT' | 'BOUNCED' | 'FAILED';
    }>;

    @Column('simple-json', { default: '[]' })
    notificationErrors!: Array<{
        userId: string;
        error: string;
        retryCount: number;
    }>;

    @Column('simple-array', { default: '' })
    remediationSteps!: string[];

    @Column('simple-array', { default: '' })
    recommendations!: string[];

    @Column('text', { nullable: true })
    internalNotes?: string;

    @Column('simple-json', { nullable: true })
    regulatoryReport?: {
        supervisoryAuthority: string;
        reportedDate: Date;
        reportNumber: string;
    };
}
