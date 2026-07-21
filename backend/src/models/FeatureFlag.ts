import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Feature Flag Status
 * Defines the operational state of a feature flag
 */
export enum FeatureFlagStatus {
  ENABLED = 'enabled', // Feature is enabled for all matching users
  DISABLED = 'disabled', // Feature is disabled
  BETA = 'beta', // Available to beta users only
  PERCENTAGE = 'percentage', // Gradual rollout by percentage
}

/**
 * Feature Flag Scope
 * Defines the target audience for a feature flag
 */
export enum FeatureFlagScope {
  GLOBAL = 'global', // All users
  ORGANIZATION = 'organization', // Specific organizations
  USER = 'user', // Specific users
  BETA_USERS = 'beta_users', // Users in beta program
}

/**
 * Feature Flag Entity
 * Manages feature toggles for gradual rollout and A/B testing
 */
@Entity('feature_flags')
@Index(['status'])
@Index(['scope'])
export class FeatureFlag {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: FeatureFlagStatus,
    default: FeatureFlagStatus.DISABLED,
  })
  status!: FeatureFlagStatus;

  @Column({
    type: 'enum',
    enum: FeatureFlagScope,
    default: FeatureFlagScope.GLOBAL,
  })
  scope!: FeatureFlagScope;

  @Column({ type: 'int', nullable: true })
  percentage?: number;

  @Column({ type: 'simple-array', nullable: true })
  targetOrganizations?: string[];

  @Column({ type: 'simple-array', nullable: true })
  targetUsers?: string[];

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
