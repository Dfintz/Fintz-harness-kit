import type { CASActivityTier } from '@sc-fleet-manager/shared-types';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * OrgActivityScore — Persisted CAS score snapshots.
 *
 * Stores the computed Composite Activity Score for each organization
 * at 15-minute intervals. Supports historical trend analysis and
 * leaderboard queries.
 *
 * Retention: 90 days, downsampled to daily after 30 days.
 */
@Entity('org_activity_scores')
@Index('idx_oas_org_date', ['organizationId', 'computedAt'])
@Index('idx_oas_score', ['score'])
export class OrgActivityScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @Column('decimal', { precision: 5, scale: 2 })
  score!: number;

  @Column({ length: 20 })
  tier!: CASActivityTier;

  /**
   * Breakdown of the CAS score into individual component scores.
   *
   * **Schema:** { onlinePresence, engagement, consistency, voiceActivity, siteActivity }
   * All values are in [0, 100] with 1 decimal precision.
   *
   * **Note:** JSONB is not validated on entity load. Consumers must handle cases where
   * the breakdown might be malformed (e.g., missing fields, non-numeric values).
   * In practice, only CASComputationService.persistScore() writes this field,
   * ensuring well-formed data. If manual SQL updates or data migrations are performed,
   * validation should be added (see backend/src/models/OrgActivityScore.ts for TODO).
   *
   * **TODO:** Add class-validator transformer for production-grade validation.
   * See: docs/CAS_ARCHITECTURE_BRIEF.md § 3 FINDING 2.
   */
  @Column('jsonb')
  breakdown!: {
    onlinePresence: number;
    engagement: number;
    consistency: number;
    voiceActivity: number;
    siteActivity: number;
  };

  @Column('int')
  memberCount!: number;

  @Column('timestamp')
  computedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
