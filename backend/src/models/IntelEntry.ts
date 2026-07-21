import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from './Organization';
import { User } from './User';

/**
 * Access level for Intel entries
 */
export enum IntelAccessLevel {
  READ = 'read', // Can only read
  WRITE = 'write', // Can read and create
  EDIT = 'edit', // Can read, create, and edit
  DELETE = 'delete', // Full access including delete
  ADMIN = 'admin', // Full access plus manage Intel officers
}

/**
 * Classification level for Intel entries
 */
export enum IntelClassification {
  PUBLIC = 'public', // Visible to all org members
  RESTRICTED = 'restricted', // Visible to Intel officers only
  CONFIDENTIAL = 'confidential', // Higher clearance required
  SECRET = 'secret', // Highest clearance required
  TOP_SECRET = 'top_secret', // Org owner and highest Intel officer only
}

/**
 * Intel entry categories
 */
export enum IntelCategory {
  STRATEGIC = 'strategic', // Strategic intelligence
  TACTICAL = 'tactical', // Tactical operations
  PERSONNEL = 'personnel', // Personnel information
  ENEMY = 'enemy', // Enemy/threat intelligence
  ALLIANCE = 'alliance', // Alliance/diplomatic
  ECONOMIC = 'economic', // Economic/trading
  TECHNICAL = 'technical', // Technical specifications
  OTHER = 'other', // Miscellaneous
}

/**
 * Intel Entry entity - stores sensitive game intelligence
 */
@Entity('intel_entries')
export class IntelEntry {
  @PrimaryColumn()
  id!: string;

  @Column()
  @Index()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column()
  title!: string;

  @Column('text')
  content!: string;

  @Column({
    type: 'varchar',
    enum: IntelClassification,
    default: IntelClassification.RESTRICTED,
  })
  @Index()
  classification!: IntelClassification;

  @Column({
    type: 'varchar',
    enum: IntelCategory,
    default: IntelCategory.OTHER,
  })
  @Index()
  category!: IntelCategory;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ nullable: true })
  location?: string;

  @Column({ type: 'timestamp', nullable: true })
  eventDate?: Date;

  @Column({ default: false })
  @Index()
  isArchived!: boolean;

  @Column()
  @Index()
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdBy' })
  creator?: User;

  @Column({ nullable: true })
  updatedBy?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedBy' })
  updater?: User;

  @CreateDateColumn()
  @Index()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Aging and Declassification fields
  @Column({ type: 'timestamp', nullable: true })
  @Index()
  declassificationDate?: Date; // When intel should be declassified

  @Column({
    type: 'varchar',
    enum: IntelClassification,
    nullable: true,
  })
  targetClassification?: IntelClassification; // Classification level to declassify to

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  reviewDate?: Date; // Next mandatory review date

  @Column({ type: 'int', nullable: true })
  reviewIntervalDays?: number; // Days between required reviews

  @Column({ type: 'timestamp', nullable: true })
  lastReviewedAt?: Date; // When intel was last reviewed

  @Column({ nullable: true })
  lastReviewedBy?: string; // Who last reviewed the intel

  @Column({ default: false })
  autoDeclassify!: boolean; // Whether to auto-declassify on date

  @Column({ type: 'timestamp', nullable: true })
  expirationDate?: Date; // When intel should expire/be deleted

  @Column({ default: false })
  isExpired!: boolean; // Whether intel has expired

  // Sharing tracking
  @Column({ default: false })
  isShared!: boolean; // Whether intel is shared with other orgs

  @Column({ type: 'int', default: 0 })
  shareCount!: number; // Number of active shares

  // Metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    attachments?: string[];
    relatedEntries?: string[];
    sources?: string[];
    reliability?: number; // 1-5 scale
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    expirationDate?: Date;
    customFields?: Record<string, unknown>;
    // Aging metadata
    agingHistory?: {
      date: Date;
      action: string;
      fromClassification?: IntelClassification;
      toClassification?: IntelClassification;
      performedBy?: string;
      reason?: string;
    }[];
    // Sharing metadata
    shareHistory?: {
      date: Date;
      action: string;
      targetOrgId?: string;
      performedBy?: string;
    }[];
  };
}
