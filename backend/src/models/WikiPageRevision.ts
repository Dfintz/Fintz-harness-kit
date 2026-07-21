import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { WikiPage } from './WikiPage';

/**
 * WikiPageRevision Entity
 *
 * Stores a snapshot of a wiki page's content at a specific version.
 * Every update to a WikiPage auto-creates a new revision, enabling
 * full edit history, diff comparison, and restoration.
 *
 * Cascade-deletes when the parent WikiPage is removed.
 */
@Entity('wiki_page_revisions')
@Index('idx_revision_page', ['pageId'])
@Index('idx_revision_page_version', ['pageId', 'version'])
export class WikiPageRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  pageId!: string;

  @ManyToOne(() => WikiPage, page => page.revisions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pageId' })
  page!: WikiPage;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'uuid' })
  editedBy!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  changeDescription!: string | null;

  @Column({ type: 'int' })
  version!: number;

  @CreateDateColumn()
  editedAt!: Date;
}
