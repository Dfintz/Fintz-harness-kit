import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Alert condition type for price monitoring
 */
export enum PriceAlertCondition {
  ABOVE = 'above',
  BELOW = 'below',
  CHANGE_PERCENT = 'change_percent',
}

/**
 * PriceAlert entity — Persists user price alerts to the database.
 * Previously stored in-memory (Map), now fully DB-backed for reliability.
 */
@Entity('price_alerts')
export class PriceAlert {
  @PrimaryColumn('varchar', { length: 64 })
  id!: string;

  @Index()
  @Column('varchar', { length: 255 })
  userId!: string;

  @Index()
  @Column('varchar', { length: 255 })
  commodity!: string;

  @Column('varchar', { length: 255, nullable: true })
  location?: string;

  @Column({
    type: 'varchar',
    length: 32,
  })
  condition!: PriceAlertCondition;

  @Column('float')
  threshold!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastTriggered?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
