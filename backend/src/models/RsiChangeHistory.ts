import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Type of RSI entity being tracked
 */
export type RsiChangeEntityType = 'citizen' | 'organization' | 'member';

/**
 * RSI Change History — tracks field-level changes detected during crawls.
 * Mirrors the SENTRY v1 API `changes[]` concept: records the old and new
 * value for every field that changed between consecutive crawls.
 */
@Entity('rsi_change_history')
@Index(['entityType', 'entityId'])
@Index(['entityType', 'entityId', 'fieldName'])
@Index(['detectedAt'])
export class RsiChangeHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The kind of entity that changed */
  @Column({ type: 'varchar', length: 20 })
  entityType!: RsiChangeEntityType;

  /**
   * Identifier of the entity:
   * - citizen: RSI handle
   * - organization: SID
   * - member: "SID:handle" composite
   */
  @Column({ type: 'varchar', length: 255 })
  entityId!: string;

  /** The field that changed (e.g., "rank", "memberCount", "name") */
  @Column({ type: 'varchar', length: 100 })
  fieldName!: string;

  /** Previous value (stringified). Null for newly discovered entities. */
  @Column({ type: 'text', nullable: true })
  oldValue?: string | null;

  /** New value (stringified) */
  @Column({ type: 'text', nullable: true })
  newValue?: string | null;

  /** When the change was detected by the crawler */
  @CreateDateColumn()
  detectedAt!: Date;
}
