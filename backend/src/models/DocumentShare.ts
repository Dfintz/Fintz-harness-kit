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

// ==================== ENUMS ====================

export enum SharePermission {
  VIEW = 'view',
  DOWNLOAD = 'download',
  EDIT = 'edit',
}

// ==================== ENTITY ====================

/**
 * DocumentShare Entity Model
 *
 * Tracks sharing of documents with specific users or roles.
 * Supports time-limited sharing via expiresAt.
 */
@Entity('document_shares')
@Index(['documentId', 'sharedWithUserId'])
@Index(['sharedWithUserId'])
export class DocumentShare {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  documentId!: string;

  @Column({ type: 'varchar', nullable: true })
  sharedWithUserId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sharedWithRole?: string;

  @Column({ type: 'varchar', length: 20, default: SharePermission.VIEW })
  permission!: SharePermission;

  @Column({ type: 'varchar' })
  sharedBy!: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @ManyToOne(() => Document, d => d.shares, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document!: Document;

  @CreateDateColumn()
  createdAt!: Date;

  // ==================== COMPUTED PROPERTIES ====================

  get isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return new Date() > this.expiresAt;
  }
}
