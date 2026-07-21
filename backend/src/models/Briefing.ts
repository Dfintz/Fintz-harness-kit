import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BriefingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

/**
 * Intelligence classification levels for briefing access control.
 * Mirrors the IntelClassification enum from IntelEntry.
 */
export enum BriefingClassification {
  PUBLIC = 'public',
  RESTRICTED = 'restricted',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
  TOP_SECRET = 'top_secret',
}

@Entity('briefings')
@Index(['organizationId', 'createdAt'])
export class Briefing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column()
  creatorId!: string;

  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  @Column({ nullable: true })
  missionId?: string;

  @Column({
    type: 'enum',
    enum: BriefingClassification,
    default: BriefingClassification.RESTRICTED,
  })
  classification!: BriefingClassification;

  /** Activity/operation IDs this briefing is bound to */
  @Column('simple-json', { nullable: true, default: '[]' })
  operationIds?: string[];

  @Column({ type: 'simple-json', default: '[]' })
  elements!: Array<{
    id: string;
    type:
      | 'text'
      | 'shape'
      | 'line'
      | 'arrow'
      | 'marker'
      | 'image'
      | 'map'
      | 'waypoint'
      | 'video'
      | 'link'
      | 'file'
      | 'tactical-unit'
      | 'map-reference'
      | 'interdiction-point'
      | 'ship-map';
    position: { x: number; y: number };
    data: unknown; // Each element type has different data structure
  }>;

  @Column({
    type: 'enum',
    enum: BriefingStatus,
    default: BriefingStatus.DRAFT,
  })
  status!: BriefingStatus;

  @Column('simple-array', { nullable: true })
  participants?: string[];

  @Column({ default: 1 })
  version!: number;

  @Column({ nullable: true })
  backgroundImage?: string;

  /** Per-page metadata (background images). Elements use pageIndex to associate with a page. */
  @Column('simple-json', { nullable: true, default: '[]' })
  pages?: Array<{ backgroundImage?: string | null }>;

  @Column('simple-array', { nullable: true })
  tags?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
