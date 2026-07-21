import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import type { OrganizationRelationshipSummary } from '../types/models';

/**
 * Enhanced relationship types for organizations
 */
export enum RelationshipType {
  // Positive Relationships
  ALLIED = 'allied', // Strong military/strategic alliance
  PARTNERSHIP = 'partnership', // Business or operational partnership
  COOPERATIVE = 'cooperative', // Friendly cooperation
  AFFILIATED = 'affiliated', // Loose affiliation
  TRADING_PARTNER = 'trading_partner', // Trading relationship

  // Neutral Relationships
  NEUTRAL = 'neutral', // No special relationship
  OBSERVER = 'observer', // Observing/monitoring
  INTERESTED = 'interested', // Interested in relations

  // Negative Relationships
  COMPETITIVE = 'competitive', // Business competition
  RIVAL = 'rival', // Rivalry
  HOSTILE = 'hostile', // Hostile relations
  WAR = 'war', // Active conflict

  // Special Relationships
  PARENT = 'parent', // Parent organization
  SUBSIDIARY = 'subsidiary', // Subsidiary organization
  MERGER_PENDING = 'merger_pending', // Pending merger
  UNDER_NEGOTIATION = 'under_negotiation', // Negotiating relationship
}

/**
 * Relationship status
 */
export enum RelationshipStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
  EXPIRED = 'expired',
}

/**
 * Enhanced organization relationship model with trust scores and metadata
 */
@Entity('organization_relationships')
@Index(['organizationId', 'targetOrganizationId'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['trustScore'])
export class OrganizationRelationship {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  organizationId!: string;

  @Index()
  @Column()
  targetOrganizationId!: string;

  @Column({
    type: 'varchar',
    enum: RelationshipType,
    default: RelationshipType.NEUTRAL,
  })
  type!: RelationshipType;

  @Column({
    type: 'varchar',
    enum: RelationshipStatus,
    default: RelationshipStatus.ACTIVE,
  })
  status!: RelationshipStatus;

  // Trust and Relationship Metrics
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 50.0,
  })
  trustScore!: number; // 0-100 scale

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 50.0,
  })
  relationshipStrength!: number; // 0-100 scale

  @Column({
    type: 'int',
    default: 0,
  })
  interactionCount!: number; // Total interactions

  @Column({
    type: 'int',
    default: 0,
  })
  positiveInteractions!: number;

  @Column({
    type: 'int',
    default: 0,
  })
  negativeInteractions!: number;

  // Relationship Details
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'simple-json', nullable: true })
  metadata?: {
    tradeVolume?: number;
    sharedEvents?: number;
    cooperativeOperations?: number;
    conflicts?: number;
    treaties?: string[];
    agreements?: string[];
    customFields?: Record<string, unknown>;
  };

  // Contact Information
  @Column({ nullable: true })
  primaryContact?: string; // User ID or name

  @Column({ nullable: true })
  contactName?: string; // Name of the primary contact

  @Column({ nullable: true })
  contactRole?: string; // Role/title of the contact

  @Column({ nullable: true })
  contactEmail?: string; // Email of the contact

  @Column({ type: 'simple-array', nullable: true })
  communicationChannels?: string[]; // Discord, email, etc.

  // Diplomatic Information
  @Column({ nullable: true })
  establishedBy?: string; // User ID who established the relationship

  @Column({ nullable: true })
  lastModifiedBy?: string; // User ID who last modified

  @Column({ type: 'timestamp', nullable: true })
  establishedDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastInteractionDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  reviewDate?: Date; // Next scheduled review

  @Column({ type: 'timestamp', nullable: true })
  expiryDate?: Date; // For time-limited agreements

  // Mutual Recognition
  @Column({ default: false })
  isMutual!: boolean; // Whether the other org has reciprocated

  @Column({ default: false })
  isMutuallyRecognized!: boolean; // Alias for isMutual for backward compatibility

  @Column({ nullable: true })
  reciprocalRelationshipId?: string; // ID of the reciprocal relationship if mutual

  // Flags
  @Column({ default: false })
  isPublic!: boolean; // Whether relationship is publicly visible

  @Column({ default: false })
  requiresApproval!: boolean; // Whether changes require approval

  @Column({ default: false })
  autoRenew!: boolean; // Auto-renew on expiry

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Methods for relationship management

  /**
   * Calculate overall relationship health (0-100)
   */
  calculateHealthScore(): number {
    const trustWeight = 0.4;
    const strengthWeight = 0.3;
    const interactionWeight = 0.2;
    const recentActivityWeight = 0.1;

    // Base scores
    const trustComponent = this.trustScore * trustWeight;
    const strengthComponent = this.relationshipStrength * strengthWeight;

    // Interaction quality (positive vs negative)
    const totalInteractions = this.interactionCount || 1;
    const positiveRatio = (this.positiveInteractions / totalInteractions) * 100;
    const interactionComponent = positiveRatio * interactionWeight;

    // Recent activity bonus
    const daysSinceLastInteraction = this.lastInteractionDate
      ? Math.floor((Date.now() - this.lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24))
      : 365;
    const activityScore = Math.max(0, 100 - daysSinceLastInteraction);
    const recentActivityComponent = activityScore * recentActivityWeight;

    return Math.min(
      100,
      Math.round(
        trustComponent + strengthComponent + interactionComponent + recentActivityComponent
      )
    );
  }

  /**
   * Get relationship tier based on metrics
   */
  getRelationshipTier(): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    const health = this.calculateHealthScore();
    if (health >= 80) {
      return 'excellent';
    }
    if (health >= 60) {
      return 'good';
    }
    if (health >= 40) {
      return 'fair';
    }
    if (health >= 20) {
      return 'poor';
    }
    return 'critical';
  }

  /**
   * Check if relationship needs review
   */
  needsReview(): boolean {
    if (this.reviewDate && this.reviewDate < new Date()) {
      return true;
    }
    if (this.calculateHealthScore() < 40) {
      return true;
    }
    if (this.negativeInteractions > this.positiveInteractions * 2) {
      return true;
    }
    return false;
  }

  /**
   * Check if relationship is expired
   */
  isExpired(): boolean {
    if (!this.expiryDate) {
      return false;
    }
    return this.expiryDate < new Date();
  }

  /**
   * Get trust level descriptor
   */
  getTrustLevel(): string {
    if (this.trustScore >= 90) {
      return 'Complete Trust';
    }
    if (this.trustScore >= 75) {
      return 'High Trust';
    }
    if (this.trustScore >= 60) {
      return 'Moderate Trust';
    }
    if (this.trustScore >= 40) {
      return 'Low Trust';
    }
    if (this.trustScore >= 20) {
      return 'Minimal Trust';
    }
    return 'No Trust';
  }

  /**
   * Get strength level descriptor
   */
  getStrengthLevel(): string {
    if (this.relationshipStrength >= 90) {
      return 'Very Strong';
    }
    if (this.relationshipStrength >= 75) {
      return 'Strong';
    }
    if (this.relationshipStrength >= 60) {
      return 'Moderate';
    }
    if (this.relationshipStrength >= 40) {
      return 'Weak';
    }
    if (this.relationshipStrength >= 20) {
      return 'Very Weak';
    }
    return 'Negligible';
  }

  /**
   * Get summary for display
   */
  getSummary(): OrganizationRelationshipSummary {
    return {
      id: this.id,
      orgId1: this.organizationId,
      orgId2: this.targetOrganizationId,
      relationship: this.type,
      type: this.type,
      status: this.status,
      trustScore: this.trustScore,
      trustLevel: this.getTrustLevel(),
      relationshipStrength: this.relationshipStrength,
      strengthLevel: this.getStrengthLevel(),
      healthScore: this.calculateHealthScore(),
      tier: this.getRelationshipTier(),
      interactionCount: this.interactionCount,
      positiveRatio:
        this.interactionCount > 0
          ? ((this.positiveInteractions / this.interactionCount) * 100).toFixed(1)
          : 0,
      lastInteraction: this.lastInteractionDate,
      needsReview: this.needsReview(),
      isExpired: this.isExpired(),
      isMutual: this.isMutual,
    };
  }
}
