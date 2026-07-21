import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import { WikiPageRevision } from './WikiPageRevision';

/**
 * WikiPage Entity
 *
 * Represents a single wiki/knowledge-base page within an organization.
 * Supports hierarchical tree structure (parentPageId), Markdown content,
 * slug-based addressing, tagging, version tracking, and full-text search
 * via a PostgreSQL tsvector column (created in migration, not mapped here).
 *
 * Extends TenantEntity for multi-tenant isolation with soft delete support.
 */
@Entity('wiki_pages')
@Index('idx_wiki_org_slug', ['organizationId', 'slug'], { unique: true })
@Index('idx_wiki_parent', ['parentPageId'])
@Index('idx_wiki_org_created', ['organizationId', 'createdAt'])
export class WikiPage extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  @Column({ type: 'text', default: '' })
  content!: string;

  @Column({ type: 'uuid', nullable: true })
  parentPageId!: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column('simple-array', { default: '' })
  tags!: string[];

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'boolean', default: false })
  isLocked!: boolean;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @Column({ type: 'varchar', nullable: true })
  lastEditedBy!: string | null;

  /** When set, page is scoped to a federation rather than org-only */
  @Column({ type: 'uuid', nullable: true })
  federationId!: string | null;

  /** Visibility within the federation (only relevant when federationId is set) */
  @Column({ type: 'varchar', length: 50, nullable: true, default: 'members' })
  federationVisibility!: string | null;

  @OneToMany(() => WikiPageRevision, revision => revision.page)
  revisions?: WikiPageRevision[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
