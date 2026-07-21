import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ExternalCatalogSource {
  SCMDB = 'scmdb',
  SC_CRAFT = 'sc-craft',
}

export enum ExternalCatalogRecordType {
  CONTRACT = 'contract',
  BLUEPRINT = 'blueprint',
  RESOURCE = 'resource',
}

/**
 * External catalog records are GLOBAL/SHARED, not per-organization.
 *
 * They represent a read-only cache of data from external services (e.g., SCMDB — Star Citizen
 * Mission Database). All organizations see the same catalog entries.
 *
 * Organizations import FROM this global catalog INTO their own org-scoped Mission records.
 * There is intentionally NO organizationId field here.
 *
 * Pattern: Import-from-Global-Catalog
 *   ExternalCatalogRecord (global read) → MissionService.importScmdbMission*() → Mission (org-scoped write)
 */
@Entity('external_catalog_records')
@Index(['source', 'recordType', 'externalId'], { unique: true })
@Index(['source', 'recordType', 'isActive'])
@Index(['source', 'recordType', 'isActive', 'category'])
export class ExternalCatalogRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  source!: ExternalCatalogSource;

  @Column({ type: 'varchar', length: 32 })
  recordType!: ExternalCatalogRecordType;

  @Column({ type: 'varchar', length: 255 })
  externalId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  category?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sourceVersion?: string;

  @Column({ type: 'varchar', length: 64 })
  payloadHash!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  firstSeenAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastSeenAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastSyncedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
