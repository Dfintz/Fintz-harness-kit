import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * OrgActivityHeatmap — Persisted heatmap samples for activity pattern analysis.
 *
 * Stores org-level hourly aggregates sampled by the CAS background job.
 * Each row represents one (dayOfWeek, hour) sample for an org at a point in time.
 * The read path averages across 7 days via SQL AVG() to produce the 168-cell grid.
 *
 * Retention: 14 days.
 */
@Entity('org_activity_heatmaps')
@Index('idx_oah_org_sampled', ['organizationId', 'sampledAt'])
@Index('idx_oah_org_cell', ['organizationId', 'dayOfWeek', 'hour'])
export class OrgActivityHeatmap {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @Column('smallint')
  dayOfWeek!: number;

  @Column('smallint')
  hour!: number;

  @Column('int', { default: 0 })
  presenceCount!: number;

  @Column('int', { default: 0 })
  siteActiveCount!: number;

  @Column('decimal', { precision: 8, scale: 2, default: 0 })
  rawScore!: number;

  @Column('int')
  memberCount!: number;

  @Column('timestamp')
  sampledAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
