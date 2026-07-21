import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import { Document } from './Document';

// ==================== ENTITY ====================

/**
 * DocumentFolder Entity Model
 *
 * Hierarchical folder structure for organizing documents.
 * Max depth: 3 levels (root → level 1 → level 2 → level 3).
 *
 * MULTI-TENANCY: Inherits TenantEntity for org scoping.
 */
@Entity('document_folders')
@Index(['organizationId', 'parentId'])
@Index(['organizationId', 'name'])
export class DocumentFolder extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'uuid', nullable: true })
  parentId?: string;

  @Column({ type: 'integer', default: 0 })
  sortOrder!: number;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @ManyToOne(() => DocumentFolder, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent?: DocumentFolder;

  @OneToMany(() => DocumentFolder, f => f.parent)
  children?: DocumentFolder[];

  @OneToMany(() => Document, d => d.folder)
  documents?: Document[];

  @CreateDateColumn()
  createdAt!: Date;
}
