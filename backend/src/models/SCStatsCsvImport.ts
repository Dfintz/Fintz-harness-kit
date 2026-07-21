import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Stores parsed SCStats CSV import data per user.
 *
 * Each user has at most one record. Re-importing replaces the data.
 * All CSV data is stored as JSONB for flexible querying.
 */
@Entity('scstats_csv_imports')
@Index(['userId'], { unique: true })
export class SCStatsCsvImport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  // Parsed CSV data stored as JSONB
  @Column({ type: 'jsonb', nullable: true })
  playtimeData!: Record<string, unknown>[] | null;

  @Column({ type: 'jsonb', nullable: true })
  loadoutTopData!: Record<string, unknown>[] | null;

  @Column({ type: 'jsonb', nullable: true })
  loadoutDetailData!: Record<string, unknown>[] | null;

  @Column({ type: 'jsonb', nullable: true })
  purchasesData!: Record<string, unknown>[] | null;

  @Column({ type: 'jsonb', nullable: true })
  shipsData!: Record<string, unknown>[] | null;

  // Import timestamps per category
  @Column({ type: 'timestamptz', nullable: true })
  playtimeImportedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  loadoutImportedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  purchasesImportedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  shipsImportedAt!: Date | null;

  // Derived summary stats (JSONB)
  @Column({ type: 'jsonb', nullable: true })
  summary!: Record<string, unknown> | null;

  // Consent tracking
  @Column({ default: false })
  consentGranted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  consentDate!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
