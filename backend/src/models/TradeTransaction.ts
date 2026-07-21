import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Organization } from './Organization';
import { TradingRoute } from './TradingRoute';

/**
 * Status of a trade transaction
 */
export enum TradeTransactionStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABORTED = 'aborted',
}

/**
 * Individual trade transaction record.
 *
 * Tracks each executed route run with per-user attribution.
 * Feeds into TradeUserReputation aggregate scoring.
 *
 * Sprint 20-D
 */
@Entity('trade_transactions')
@Index(['userId', 'organizationId'])
@Index(['routeId', 'organizationId'])
@Index(['organizationId', 'executedAt'])
export class TradeTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  routeId!: string;

  @ManyToOne(() => TradingRoute, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'routeId' })
  route?: TradingRoute;

  @Column()
  @Index()
  userId!: string;

  @Column({ nullable: true })
  fleetId?: string;

  @Column()
  @Index()
  organizationId!: string;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column({ type: 'varchar', default: TradeTransactionStatus.COMPLETED })
  successStatus!: TradeTransactionStatus;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  estimatedProfit!: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  actualProfit!: number;

  @Column('int', { default: 0 })
  durationMinutes!: number;

  @CreateDateColumn()
  executedAt!: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  /**
   * Calculate estimate accuracy as a percentage (0–100).
   * 100 = actual matched estimated exactly.
   */
  getEstimateAccuracy(): number {
    if (this.estimatedProfit === 0) {
      return 0;
    }
    const ratio = Number(this.actualProfit) / Number(this.estimatedProfit);
    // Clamp between 0 and 2 then scale: 1.0 → 100%, deviation → lower
    const accuracy = Math.max(0, 100 - Math.abs(1 - ratio) * 100);
    return Math.round(Math.max(0, Math.min(100, accuracy)));
  }
}
