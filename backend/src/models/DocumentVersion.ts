import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Document } from './Document';

// ==================== ENTITY ====================

/**
 * DocumentVersion Entity Model
 *
 * Tracks file versions for a document. Each version has its own
 * blob path in Azure storage. Versions are immutable once created.
 */
@Entity('document_versions')
@Index(['documentId', 'version'])
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  documentId!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ type: 'varchar', length: 1000 })
  blobPath!: string;

  @Column({ type: 'bigint' })
  fileSize!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  changeNote?: string;

  @Column({ type: 'varchar' })
  uploadedBy!: string;

  @ManyToOne(() => Document, d => d.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document!: Document;

  @CreateDateColumn()
  createdAt!: Date;
}
