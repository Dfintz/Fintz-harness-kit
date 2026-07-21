import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import type { DocumentFolder } from './DocumentFolder';
import type { DocumentShare } from './DocumentShare';
import type { DocumentVersion } from './DocumentVersion';

// ==================== ENTITY ====================

/**
 * Document Entity Model
 *
 * Represents a file uploaded to an organization's document library.
 * Supports versioning, folder organization, sharing, and soft delete.
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 * STORAGE: File content stored in Azure Blob Storage.
 */
@Entity('documents')
@Index(['organizationId', 'folderId'])
@Index(['organizationId', 'name'])
@Index(['organizationId', 'mimeType'])
@Index(['createdBy'])
export class Document extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', nullable: true })
  folderId?: string;

  @Column({ type: 'varchar', length: 255 })
  mimeType!: string;

  @Column({ type: 'bigint' })
  fileSize!: number;

  @Column({ type: 'varchar', length: 1000 })
  blobPath!: string;

  @Column({ type: 'uuid', nullable: true })
  currentVersionId?: string;

  @Column({ type: 'integer', default: 0 })
  downloadCount!: number;

  @Column({ type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'varchar' })
  createdBy!: string;

  @Column({ type: 'varchar', nullable: true })
  updatedBy?: string;

  @ManyToOne('DocumentFolder', { nullable: true })
  @JoinColumn({ name: 'folderId' })
  folder?: DocumentFolder;

  @OneToMany('DocumentVersion', 'document')
  versions?: DocumentVersion[];

  @OneToMany('DocumentShare', 'document')
  shares?: DocumentShare[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @VersionColumn()
  version!: number;

  // ==================== COMPUTED PROPERTIES ====================

  get isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  get isPdf(): boolean {
    return this.mimeType === 'application/pdf';
  }

  get fileSizeMb(): number {
    return Number(this.fileSize) / (1024 * 1024);
  }
}
