import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Tunnel } from './Tunnel';

/**
 * Persisted analytics entry for tunnel activity
 * Aggregated per tunnel per hour for efficient querying
 */
@Entity('tunnel_analytics')
@Index('IDX_tunnel_analytics_tunnel_period', ['tunnelId', 'periodStart'])
export class TunnelAnalyticsEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_tunnel_analytics_tunnel')
  tunnelId!: string;

  @ManyToOne(() => Tunnel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tunnelId' })
  tunnel?: Tunnel;

  /** Start of the aggregation period (hourly buckets) */
  @Column('timestamp')
  @Index('IDX_tunnel_analytics_period')
  periodStart!: Date;

  /** Number of messages relayed in this period */
  @Column({ default: 0 })
  messagesRelayed!: number;

  /** Number of messages blocked in this period */
  @Column({ default: 0 })
  messagesBlocked!: number;

  /** Number of unique users who sent messages in this period */
  @Column({ default: 0 })
  uniqueUsers!: number;

  /** Peak connected server count during this period */
  @Column({ default: 0 })
  peakConnections!: number;

  /** Number of attachments relayed */
  @Column({ default: 0 })
  attachmentsRelayed!: number;

  /** Number of reactions relayed */
  @Column({ default: 0 })
  reactionsRelayed!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
