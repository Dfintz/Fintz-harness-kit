import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ActivityType, ActivityVisibility } from './Activity';
import { TenantEntity } from './base/TenantEntity';

export enum ActivityTemplateCategory {
  COMBAT = 'combat',
  MINING = 'mining',
  TRADING = 'trading',
  EXPLORATION = 'exploration',
  LOGISTICS = 'logistics',
  SOCIAL = 'social',
  TRAINING = 'training',
  CUSTOM = 'custom',
}

/**
 * Stores default values for Activity fields.
 * When applying a template, these fields are merged with user overrides.
 */
export interface ActivityTemplateData {
  description?: string;
  activityType?: ActivityType;
  visibility?: ActivityVisibility;
  maxParticipants?: number;
  minParticipants?: number;
  locationSystem?: string;
  locationPlanet?: string;
  locationDetails?: string;
  estimatedDuration?: number;
  requirements?: string[];
  objectives?: string[];
  roleRequirements?: Array<{
    role: string;
    count: number;
    required: boolean;
  }>;
  resourceRequirements?: Array<{
    resource: string;
    quantity: number;
    required: boolean;
  }>;
  requiredShips?: string[];
  preferredShips?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

@Entity('activity_templates')
@Index(['organizationId', 'category'])
@Index(['organizationId', 'createdBy'])
@Index(['isPublic', 'isActive'])
export class ActivityTemplate extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ActivityType })
  activityType: ActivityType;

  @Column({
    type: 'enum',
    enum: ActivityTemplateCategory,
    default: ActivityTemplateCategory.CUSTOM,
  })
  category: ActivityTemplateCategory;

  @Column({ type: 'jsonb', default: {} })
  templateData: ActivityTemplateData;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  usageCount: number;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdByName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  incrementUsage(): void {
    this.usageCount += 1;
  }
}
