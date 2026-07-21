import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

import { FeatureFlag } from './FeatureFlag';

/**
 * Feature Flag Action Type
 */
export enum FeatureFlagAction {
    CREATED = 'created',
    UPDATED = 'updated',
    DELETED = 'deleted',
    EVALUATED = 'evaluated'
}

/**
 * Feature Flag Audit Log Entity
 * Tracks all changes and evaluations of feature flags for analytics and compliance
 */
@Entity('feature_flag_audit_logs')
@Index(['featureFlagId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['userId'])
export class FeatureFlagAuditLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    @Index()
    featureFlagId!: string;

    @ManyToOne(() => FeatureFlag, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'featureFlagId' })
    featureFlag?: FeatureFlag;

    @Column({
        type: 'enum',
        enum: FeatureFlagAction
    })
    action!: FeatureFlagAction;

    @Column({ nullable: true })
    userId?: string;

    @Column({ nullable: true })
    organizationId?: string;

    @Column({ type: 'simple-json', nullable: true })
    previousValue?: Record<string, unknown>;

    @Column({ type: 'simple-json', nullable: true })
    newValue?: Record<string, unknown>;

    @Column({ type: 'boolean', nullable: true })
    evaluationResult?: boolean;

    @Column({ type: 'text', nullable: true })
    metadata?: string;

    @CreateDateColumn()
    createdAt!: Date;
}
