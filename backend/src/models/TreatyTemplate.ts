import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Treaty template category
 */
export type TreatyTemplateCategory =
  | 'mutual_defense'
  | 'trade'
  | 'non_aggression'
  | 'resource_sharing'
  | 'intel_sharing'
  | 'military_cooperation'
  | 'custom';

/**
 * Where the template can be used
 */
export type TreatyTemplateScope = 'alliance' | 'federation' | 'both';

/**
 * A single clause within a treaty template
 */
export interface TreatyClause {
  id: string;
  title: string;
  text: string;
  isRequired: boolean;
  sortOrder: number;
}

/**
 * Treaty Template
 *
 * Reusable treaty agreement templates for alliances and federations.
 * Organizations can create custom templates or use the built-in ones.
 *
 * Built-in templates have organizationId = null and isBuiltIn = true.
 * Custom templates belong to an organization and can be published
 * to make them available to allied orgs or federation members.
 */
@Entity('treaty_templates')
@Index('idx_treaty_tpl_org', ['organizationId'])
@Index('idx_treaty_tpl_category', ['category'])
@Index('idx_treaty_tpl_scope', ['scope'])
@Index('idx_treaty_tpl_builtin', ['isBuiltIn'])
@Index('idx_treaty_tpl_published', ['isPublished'])
export class TreatyTemplate {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar' })
  category!: TreatyTemplateCategory;

  @Column({ type: 'varchar', default: 'both' })
  scope!: TreatyTemplateScope;

  /** Ordered list of clauses that make up this treaty template */
  @Column('jsonb', { default: '[]' })
  clauses!: TreatyClause[];

  /** System-provided built-in template (not editable by users) */
  @Column({ default: false })
  isBuiltIn!: boolean;

  /** Organization that created this template (null for built-in) */
  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  /** Whether the template is published and available for use */
  @Column({ default: false })
  isPublished!: boolean;

  /** Version number for tracking template revisions */
  @Column({ type: 'int', default: 1 })
  version!: number;

  /** Tags for discoverability */
  @Column('simple-array', { default: '' })
  tags!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
