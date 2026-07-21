import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import {
  OrganizationRelationship,
  RelationshipStatus,
  RelationshipType,
} from '../../models/OrganizationRelationship';
import {
  ChangeType,
  InteractionSentiment,
  RelationshipHistory,
} from '../../models/RelationshipHistory';

interface CreateRelationshipParams {
  organizationId: string;
  targetOrganizationId: string;
  type: RelationshipType;
  status?: RelationshipStatus;
  description?: string;
  notes?: string;
  tags?: string[];
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  establishedById?: string;
  establishedByName?: string;
  metadata?: Record<string, unknown>;
}

interface UpdateRelationshipParams {
  type?: RelationshipType;
  status?: RelationshipStatus;
  description?: string;
  notes?: string;
  tags?: string[];
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  communicationChannels?: string[];
  reviewDate?: string | null;
  expiryDate?: string | null;
  isPublic?: boolean;
  autoRenew?: boolean;
  metadata?: Record<string, unknown>;
}

interface RecordInteractionParams {
  relationshipId: string;
  organizationId?: string;
  sentiment: InteractionSentiment;
  description: string;
  actorId?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
}

interface CreateHistoryParams {
  relationshipId: string;
  organizationId: string;
  targetOrganizationId: string;
  changeType: ChangeType;
  description: string;
  previousValue?: unknown;
  newValue?: unknown;
  changeDetails?: Record<string, unknown>;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  reason?: string;
  notes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  isSystemGenerated?: boolean;
  isSignificant?: boolean;
  requiresNotification?: boolean;
}

interface HistoryQueryParams {
  changeTypes?: ChangeType[];
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
  isSignificant?: boolean;
  onlyPositive?: boolean;
  onlyNegative?: boolean;
  limit?: number;
  offset?: number;
}

interface HistoryAnalytics {
  totalChanges: number;
  positiveChanges: number;
  negativeChanges: number;
  neutralChanges: number;
  averageSentiment: number;
  changesByType: Record<string, number>;
  recentTrend: 'improving' | 'declining' | 'stable';
  significantChanges: number;
  mostActiveActor?: {
    id: string;
    name: string;
    changeCount: number;
  };
}

interface TrustAdjustment {
  reason: string;
  delta: number;
  sentiment?: InteractionSentiment;
  metadata?: Record<string, unknown>;
}

interface TrustRecommendation {
  currentLevel: string;
  suggestedActions: string[];
  riskFactors: string[];
  opportunities: string[];
  nextReviewDate: Date;
}

/**
 * Unified RelationshipService
 *
 * This service consolidates all relationship management functionality including:
 * - Relationship CRUD operations
 * - History tracking (formerly RelationshipHistoryService)
 * - Trust score management (formerly TrustScoreService)
 *
 * Migration:
 * - RelationshipHistoryService methods are now available on this service
 * - TrustScoreService methods are now available on this service
 */
export class RelationshipService {
  private readonly relationshipRepository: Repository<OrganizationRelationship>;
  private readonly historyRepository: Repository<RelationshipHistory>;

  // Trust adjustment weights
  private readonly TRUST_WEIGHTS = {
    VERY_POSITIVE_INTERACTION: 5,
    POSITIVE_INTERACTION: 2,
    NEUTRAL_INTERACTION: 0,
    NEGATIVE_INTERACTION: -3,
    VERY_NEGATIVE_INTERACTION: -8,
    INACTIVITY_PENALTY: -2,
  };

  // Relationship type bonuses for trust calculation
  private readonly TYPE_BONUSES: Record<string, number> = {
    [RelationshipType.ALLIED]: 15,
    [RelationshipType.PARTNERSHIP]: 12,
    [RelationshipType.COOPERATIVE]: 8,
    [RelationshipType.AFFILIATED]: 5,
    [RelationshipType.TRADING_PARTNER]: 5,
    [RelationshipType.NEUTRAL]: 0,
    [RelationshipType.OBSERVER]: 0,
    [RelationshipType.INTERESTED]: 2,
    [RelationshipType.COMPETITIVE]: -5,
    [RelationshipType.RIVAL]: -10,
    [RelationshipType.HOSTILE]: -15,
    [RelationshipType.WAR]: -25,
  };

  constructor(
    relationshipRepository?: Repository<OrganizationRelationship>,
    historyRepository?: Repository<RelationshipHistory>
  ) {
    this.relationshipRepository =
      relationshipRepository ?? AppDataSource.getRepository(OrganizationRelationship);
    this.historyRepository = historyRepository ?? AppDataSource.getRepository(RelationshipHistory);
  }

  /**
   * Calculate trust score based on various factors
   * This is a pure calculation method that doesn't persist anything
   */
  calculateTrustScore(params: {
    currentTrust: number;
    relationshipType: RelationshipType;
    interactionHistory: { positive: number; negative: number; total: number };
    durationDays: number;
    recentActivity: number;
  }): number {
    let score = params.currentTrust;

    // Apply relationship type modifier
    const typeBonus = this.TYPE_BONUSES[params.relationshipType] || 0;
    score += typeBonus;

    // Apply interaction history modifier
    if (params.interactionHistory.total > 0) {
      const positiveRatio = params.interactionHistory.positive / params.interactionHistory.total;
      const negativeRatio = params.interactionHistory.negative / params.interactionHistory.total;
      const interactionModifier = positiveRatio * 15 - negativeRatio * 20;
      score += interactionModifier;
    }

    // Apply duration bonus (longer relationships are more stable)
    if (params.durationDays > 0) {
      // Max bonus of 10 for relationships older than 365 days
      const durationBonus = Math.min(10, params.durationDays / 36.5);
      score += durationBonus;
    }

    // Apply recent activity bonus
    if (params.recentActivity > 0) {
      // Small bonus for recent activity
      score += Math.min(5, params.recentActivity / 20);
    }

    // Clamp score between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  // ==================== RELATIONSHIP CRUD OPERATIONS ====================

  /**
   * Create a new relationship with history tracking
   */
  async createRelationship(params: CreateRelationshipParams): Promise<OrganizationRelationship> {
    // Check for existing relationship
    const existing = await this.relationshipRepository.findOne({
      where: {
        organizationId: params.organizationId,
        targetOrganizationId: params.targetOrganizationId,
      },
    });

    if (existing) {
      throw new Error('Relationship already exists');
    }

    // Create relationship
    const relationship: OrganizationRelationship = this.relationshipRepository.create({
      organizationId: params.organizationId,
      targetOrganizationId: params.targetOrganizationId,
      type: params.type,
      status: params.status ?? RelationshipStatus.ACTIVE,
      description: params.description,
      notes: params.notes,
      tags: params.tags,
      contactName: params.contactName,
      contactRole: params.contactRole,
      contactEmail: params.contactEmail,
      establishedBy: params.establishedById,
      establishedDate: new Date(),
      lastInteractionDate: new Date(),
      metadata: params.metadata,
      trustScore: 50, // Default trust score
      relationshipStrength: 25, // Starting strength
      interactionCount: 0,
      positiveInteractions: 0,
      negativeInteractions: 0,
    });

    const saved: OrganizationRelationship = await this.relationshipRepository.save(relationship);

    // Record creation in history
    await this.createHistoryEntry({
      relationshipId: saved.id,
      organizationId: saved.organizationId,
      targetOrganizationId: saved.targetOrganizationId,
      changeType: ChangeType.CREATED,
      description: `Relationship established as ${params.type}`,
      newValue: params.type,
      actorId: params.establishedById,
      actorName: params.establishedByName,
      reason: params.description,
      notes: params.notes,
      tags: params.tags,
      isSignificant: true,
      requiresNotification: true,
    });

    return saved;
  }

  /**
   * Apply update params to relationship and collect change records
   */
  private applyRelationshipUpdates(
    relationship: OrganizationRelationship,
    params: UpdateRelationshipParams
  ): Array<{ type: ChangeType; old: unknown; new: unknown; description: string }> {
    const changes: Array<{ type: ChangeType; old: unknown; new: unknown; description: string }> =
      [];

    if (params.type && params.type !== relationship.type) {
      changes.push({
        type: ChangeType.TYPE_CHANGED,
        old: relationship.type,
        new: params.type,
        description: `Relationship type changed from ${relationship.type} to ${params.type}`,
      });
      relationship.type = params.type;
    }

    if (params.status && params.status !== relationship.status) {
      changes.push({
        type: ChangeType.STATUS_CHANGED,
        old: relationship.status,
        new: params.status,
        description: `Status changed from ${relationship.status} to ${params.status}`,
      });
      relationship.status = params.status;
    }

    if (params.description !== undefined) {
      relationship.description = params.description;
    }

    if (params.notes !== undefined) {
      if (params.notes !== relationship.notes) {
        changes.push({
          type: ChangeType.NOTES_UPDATED,
          old: relationship.notes,
          new: params.notes,
          description: 'Notes updated',
        });
      }
      relationship.notes = params.notes;
    }

    if (params.tags !== undefined) {
      relationship.tags = params.tags;
    }

    this.applyContactUpdates(relationship, params, changes);
    this.applyAgreementUpdates(relationship, params, changes);

    if (params.metadata !== undefined) {
      changes.push({
        type: ChangeType.METADATA_UPDATED,
        old: relationship.metadata,
        new: params.metadata,
        description: 'Metadata updated',
      });
      relationship.metadata = params.metadata;
    }

    return changes;
  }

  /**
   * Apply contact-related field updates
   */
  private applyContactUpdates(
    relationship: OrganizationRelationship,
    params: UpdateRelationshipParams,
    changes: Array<{ type: ChangeType; old: unknown; new: unknown; description: string }>
  ): void {
    if (
      params.contactName !== undefined ||
      params.contactRole !== undefined ||
      params.contactEmail !== undefined
    ) {
      changes.push({
        type: ChangeType.CONTACT_UPDATED,
        old: {
          name: relationship.contactName,
          role: relationship.contactRole,
          email: relationship.contactEmail,
        },
        new: {
          name: params.contactName ?? relationship.contactName,
          role: params.contactRole ?? relationship.contactRole,
          email: params.contactEmail ?? relationship.contactEmail,
        },
        description: 'Contact information updated',
      });
      if (params.contactName !== undefined) {
        relationship.contactName = params.contactName;
      }
      if (params.contactRole !== undefined) {
        relationship.contactRole = params.contactRole;
      }
      if (params.contactEmail !== undefined) {
        relationship.contactEmail = params.contactEmail;
      }
    }

    if (params.communicationChannels !== undefined) {
      const oldChannels = relationship.communicationChannels;
      relationship.communicationChannels = params.communicationChannels;
      if (JSON.stringify(oldChannels) !== JSON.stringify(params.communicationChannels)) {
        changes.push({
          type: ChangeType.CONTACT_UPDATED,
          old: oldChannels,
          new: params.communicationChannels,
          description: 'Communication channels updated',
        });
      }
    }
  }

  /**
   * Apply agreement/flag field updates
   */
  private applyAgreementUpdates(
    relationship: OrganizationRelationship,
    params: UpdateRelationshipParams,
    changes: Array<{ type: ChangeType; old: unknown; new: unknown; description: string }>
  ): void {
    if (params.reviewDate !== undefined) {
      relationship.reviewDate = params.reviewDate ? new Date(params.reviewDate) : undefined;
    }

    if (params.expiryDate !== undefined) {
      relationship.expiryDate = params.expiryDate ? new Date(params.expiryDate) : undefined;
    }

    if (params.isPublic !== undefined && params.isPublic !== relationship.isPublic) {
      changes.push({
        type: ChangeType.STATUS_CHANGED,
        old: relationship.isPublic,
        new: params.isPublic,
        description: `Visibility changed to ${params.isPublic ? 'public' : 'private'}`,
      });
      relationship.isPublic = params.isPublic;
    }

    if (params.autoRenew !== undefined && params.autoRenew !== relationship.autoRenew) {
      changes.push({
        type: ChangeType.METADATA_UPDATED,
        old: relationship.autoRenew,
        new: params.autoRenew,
        description: `Auto-renew ${params.autoRenew ? 'enabled' : 'disabled'}`,
      });
      relationship.autoRenew = params.autoRenew;
    }
  }

  /**
   * Update relationship with change tracking
   */
  async updateRelationship(
    relationshipId: string,
    params: UpdateRelationshipParams,
    actorId?: string,
    actorName?: string,
    organizationId?: string
  ): Promise<OrganizationRelationship> {
    const where: Record<string, string> = { id: relationshipId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const relationship = await this.relationshipRepository.findOne({ where });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    const changes = this.applyRelationshipUpdates(relationship, params);

    relationship.lastInteractionDate = new Date();

    const updated = await this.relationshipRepository.save(relationship);

    // Record all changes in history
    for (const change of changes) {
      await this.createHistoryEntry({
        relationshipId: updated.id,
        organizationId: updated.organizationId,
        targetOrganizationId: updated.targetOrganizationId,
        changeType: change.type,
        description: change.description,
        previousValue: change.old,
        newValue: change.new,
        actorId,
        actorName,
        isSignificant:
          change.type === ChangeType.TYPE_CHANGED || change.type === ChangeType.STATUS_CHANGED,
      });
    }

    return updated;
  }

  /**
   * Record an interaction and update trust/strength
   */
  async recordInteraction(params: RecordInteractionParams): Promise<OrganizationRelationship> {
    const where: Record<string, string> = { id: params.relationshipId };
    if (params.organizationId) {
      where.organizationId = params.organizationId;
    }
    const relationship = await this.relationshipRepository.findOne({ where });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    // Update interaction counts
    relationship.interactionCount++;

    if (
      params.sentiment === InteractionSentiment.VERY_POSITIVE ||
      params.sentiment === InteractionSentiment.POSITIVE
    ) {
      relationship.positiveInteractions++;
    } else if (
      params.sentiment === InteractionSentiment.VERY_NEGATIVE ||
      params.sentiment === InteractionSentiment.NEGATIVE
    ) {
      relationship.negativeInteractions++;
    }

    // Calculate trust adjustment
    const delta = this.getSentimentTrustDelta(params.sentiment);

    // Update trust score
    await this.updateTrustScore(
      relationship,
      {
        reason: params.description,
        delta,
        sentiment: params.sentiment,
        metadata: params.metadata,
      },
      params.actorId,
      params.actorName
    );

    // Record interaction in history
    await this.createHistoryEntry({
      relationshipId: relationship.id,
      organizationId: relationship.organizationId,
      targetOrganizationId: relationship.targetOrganizationId,
      changeType: ChangeType.INTERACTION_RECORDED,
      description: params.description,
      changeDetails: {
        sentiment: params.sentiment,
        trustScoreDelta: delta,
        interactionType: params.metadata?.type,
        customData: params.metadata,
      },
      actorId: params.actorId,
      actorName: params.actorName,
      isSystemGenerated: !params.actorId,
      isSignificant:
        params.sentiment === InteractionSentiment.VERY_POSITIVE ||
        params.sentiment === InteractionSentiment.VERY_NEGATIVE,
    });

    // Update relationship strength based on interaction
    const strengthDelta = this.calculateStrengthDelta(params.sentiment);
    relationship.relationshipStrength = Math.max(
      0,
      Math.min(100, relationship.relationshipStrength + strengthDelta)
    );

    relationship.lastInteractionDate = new Date();

    return this.relationshipRepository.save(relationship);
  }

  /**
   * Establish mutual relationship
   */
  async establishMutualRelationship(
    relationshipId: string,
    actorId?: string,
    actorName?: string
  ): Promise<void> {
    const relationship = await this.relationshipRepository.findOne({
      where: { id: relationshipId },
    });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    // Check if reverse relationship exists
    const reverse = await this.relationshipRepository.findOne({
      where: {
        organizationId: relationship.targetOrganizationId,
        targetOrganizationId: relationship.organizationId,
      },
    });

    if (!reverse) {
      throw new Error('Reverse relationship does not exist');
    }

    // Mark both as mutually recognized
    relationship.isMutuallyRecognized = true;
    reverse.isMutuallyRecognized = true;

    await this.relationshipRepository.save([relationship, reverse]);

    // Record in history
    await this.createHistoryEntry({
      relationshipId: relationship.id,
      organizationId: relationship.organizationId,
      targetOrganizationId: relationship.targetOrganizationId,
      changeType: ChangeType.MUTUAL_ESTABLISHED,
      description: 'Mutual relationship established',
      newValue: true,
      actorId,
      actorName,
      isSignificant: true,
      requiresNotification: true,
    });
  }

  /**
   * Get relationship with detailed information
   */
  async getRelationshipById(
    relationshipId: string,
    organizationId?: string
  ): Promise<OrganizationRelationship | null> {
    const where: Record<string, string> = { id: relationshipId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.relationshipRepository.findOne({ where });
  }

  /**
   * Get all relationships for an organization
   */
  async getOrganizationRelationships(
    organizationId: string,
    filters?: {
      type?: RelationshipType[];
      status?: RelationshipStatus[];
      minTrust?: number;
      maxTrust?: number;
    }
  ): Promise<OrganizationRelationship[]> {
    const query = this.relationshipRepository
      .createQueryBuilder('rel')
      .where('rel.organizationId = :organizationId', { organizationId });

    if (filters?.type && filters.type.length > 0) {
      query.andWhere('rel.type IN (:...types)', { types: filters.type });
    }

    if (filters?.status && filters.status.length > 0) {
      query.andWhere('rel.status IN (:...statuses)', { statuses: filters.status });
    }

    if (filters?.minTrust !== undefined) {
      query.andWhere('rel.trustScore >= :minTrust', { minTrust: filters.minTrust });
    }

    if (filters?.maxTrust !== undefined) {
      query.andWhere('rel.trustScore <= :maxTrust', { maxTrust: filters.maxTrust });
    }

    return query.getMany();
  }

  /**
   * Get relationships needing review
   */
  async getRelationshipsNeedingReview(organizationId: string): Promise<OrganizationRelationship[]> {
    const relationships = await this.getOrganizationRelationships(organizationId, {
      status: [RelationshipStatus.ACTIVE],
    });

    return relationships.filter(rel => rel.needsReview());
  }

  /**
   * Get relationship health summary
   */
  async getRelationshipHealthSummary(organizationId: string): Promise<Record<string, unknown>> {
    const relationships = await this.getOrganizationRelationships(organizationId);

    const summary = {
      total: relationships.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byHealth: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        critical: 0,
      },
      averageTrust: 0,
      averageStrength: 0,
      needingReview: 0,
      mutualRelationships: 0,
    };

    let totalTrust = 0;
    let totalStrength = 0;

    for (const rel of relationships) {
      // Count by status
      summary.byStatus[rel.status] = (summary.byStatus[rel.status] || 0) + 1;

      // Count by type
      summary.byType[rel.type] = (summary.byType[rel.type] || 0) + 1;

      // Count by health tier
      const tier = rel.getRelationshipTier();
      summary.byHealth[tier]++;

      // Accumulate scores
      totalTrust += rel.trustScore;
      totalStrength += rel.relationshipStrength;

      // Check conditions
      if (rel.needsReview()) {
        summary.needingReview++;
      }
      if (rel.isMutuallyRecognized) {
        summary.mutualRelationships++;
      }
    }

    if (relationships.length > 0) {
      summary.averageTrust = totalTrust / relationships.length;
      summary.averageStrength = totalStrength / relationships.length;
    }

    return summary;
  }

  /**
   * Terminate a relationship
   */
  async terminateRelationship(
    relationshipId: string,
    reason: string,
    actorId?: string,
    actorName?: string,
    organizationId?: string
  ): Promise<void> {
    const where: Record<string, string> = { id: relationshipId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const relationship = await this.relationshipRepository.findOne({ where });

    if (!relationship) {
      throw new Error('Relationship not found');
    }

    relationship.status = RelationshipStatus.TERMINATED;
    await this.relationshipRepository.save(relationship);

    await this.createHistoryEntry({
      relationshipId: relationship.id,
      organizationId: relationship.organizationId,
      targetOrganizationId: relationship.targetOrganizationId,
      changeType: ChangeType.TERMINATED,
      description: 'Relationship terminated',
      previousValue: RelationshipStatus.ACTIVE,
      newValue: RelationshipStatus.TERMINATED,
      reason,
      actorId,
      actorName,
      isSignificant: true,
      requiresNotification: true,
    });
  }

  /**
   * Calculate strength delta based on interaction sentiment
   */
  private calculateStrengthDelta(sentiment: InteractionSentiment): number {
    switch (sentiment) {
      case InteractionSentiment.VERY_POSITIVE:
        return 3;
      case InteractionSentiment.POSITIVE:
        return 1.5;
      case InteractionSentiment.NEUTRAL:
        return 0.5;
      case InteractionSentiment.NEGATIVE:
        return -2;
      case InteractionSentiment.VERY_NEGATIVE:
        return -5;
      default:
        return 0;
    }
  }

  // ==================== HISTORY MANAGEMENT (consolidated from RelationshipHistoryService) ====================

  /**
   * Create a new history entry
   */
  async createHistoryEntry(params: CreateHistoryParams): Promise<RelationshipHistory> {
    const history = this.historyRepository.create({
      relationshipId: params.relationshipId,
      organizationId: params.organizationId,
      targetOrganizationId: params.targetOrganizationId,
      changeType: params.changeType,
      description: params.description,
      previousValue: params.previousValue,
      newValue: params.newValue,
      changeDetails: params.changeDetails,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      reason: params.reason,
      notes: params.notes,
      tags: params.tags,
      metadata: params.metadata,
      isSystemGenerated: params.isSystemGenerated ?? false,
      isSignificant: params.isSignificant ?? false,
      requiresNotification: params.requiresNotification ?? false,
    });

    return this.historyRepository.save(history);
  }

  /**
   * Get relationship history with filtering
   */
  async getRelationshipHistory(
    relationshipId: string,
    params?: HistoryQueryParams
  ): Promise<RelationshipHistory[]> {
    const query = this.historyRepository
      .createQueryBuilder('history')
      .where('history.relationshipId = :relationshipId', { relationshipId })
      .orderBy('history.createdAt', 'DESC');

    if (params?.changeTypes && params.changeTypes.length > 0) {
      query.andWhere('history.changeType IN (:...changeTypes)', {
        changeTypes: params.changeTypes,
      });
    }

    if (params?.actorId) {
      query.andWhere('history.actorId = :actorId', { actorId: params.actorId });
    }

    if (params?.startDate) {
      query.andWhere('history.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params?.endDate) {
      query.andWhere('history.createdAt <= :endDate', { endDate: params.endDate });
    }

    if (params?.isSignificant !== undefined) {
      query.andWhere('history.isSignificant = :isSignificant', {
        isSignificant: params.isSignificant,
      });
    }

    if (params?.limit) {
      query.take(params.limit);
    }

    if (params?.offset) {
      query.skip(params.offset);
    }

    const results = await query.getMany();

    // Apply client-side filtering for complex conditions
    let filtered = results;

    if (params?.onlyPositive) {
      filtered = filtered.filter(h => h.isPositiveChange());
    }

    if (params?.onlyNegative) {
      filtered = filtered.filter(h => h.isNegativeChange());
    }

    return filtered;
  }

  /**
   * Get history for an organization (all relationships)
   */
  async getOrganizationHistory(
    organizationId: string,
    params?: HistoryQueryParams
  ): Promise<RelationshipHistory[]> {
    const query = this.historyRepository
      .createQueryBuilder('history')
      .where('history.organizationId = :organizationId', { organizationId })
      .orWhere('history.targetOrganizationId = :organizationId', { organizationId })
      .orderBy('history.createdAt', 'DESC');

    if (params?.limit) {
      query.take(params.limit);
    }

    return query.getMany();
  }

  /**
   * Get timeline of relationship changes
   */
  async getRelationshipTimeline(relationshipId: string): Promise<
    Array<{
      date: Date;
      type: string;
      summary: string;
      impact: string;
      sentiment: number;
      actor: string;
      details: string;
    }>
  > {
    const history = await this.getRelationshipHistory(relationshipId, {
      isSignificant: true,
      limit: 100,
    });

    return history.map(entry => ({
      date: entry.createdAt,
      type: entry.changeType,
      summary: entry.getChangeSummary(),
      impact: entry.getImpactLevel(),
      sentiment: entry.getSentimentScore(),
      actor: entry.actorName ?? 'System',
      details: entry.description,
    }));
  }

  /**
   * Count sentiment categories and accumulate stats from history entries
   */
  private accumulateHistoryStats(
    history: RelationshipHistory[],
    analytics: HistoryAnalytics
  ): { totalSentiment: number; actorCounts: Map<string, { name: string; count: number }> } {
    let totalSentiment = 0;
    const actorCounts = new Map<string, { name: string; count: number }>();

    for (const entry of history) {
      if (entry.isPositiveChange()) {
        analytics.positiveChanges++;
      } else if (entry.isNegativeChange()) {
        analytics.negativeChanges++;
      } else {
        analytics.neutralChanges++;
      }

      totalSentiment += entry.getSentimentScore();

      analytics.changesByType[entry.changeType] =
        (analytics.changesByType[entry.changeType] ?? 0) + 1;

      if (entry.isSignificant) {
        analytics.significantChanges++;
      }

      if (entry.actorId && entry.actorName) {
        const current = actorCounts.get(entry.actorId);
        if (current) {
          current.count++;
        } else {
          actorCounts.set(entry.actorId, { name: entry.actorName, count: 1 });
        }
      }
    }

    return { totalSentiment, actorCounts };
  }

  /**
   * Find the actor with the most changes
   */
  private findMostActiveActor(
    actorCounts: Map<string, { name: string; count: number }>
  ): { id: string; name: string; changeCount: number } | undefined {
    if (actorCounts.size === 0) {
      return undefined;
    }
    let maxCount = 0;
    let mostActive = { id: '', name: '', changeCount: 0 };
    for (const [id, data] of actorCounts.entries()) {
      if (data.count > maxCount) {
        maxCount = data.count;
        mostActive = { id, name: data.name, changeCount: data.count };
      }
    }
    return mostActive;
  }

  /**
   * Analyze relationship history for trends
   */
  async analyzeRelationshipHistory(
    relationshipId: string,
    days: number = 30
  ): Promise<HistoryAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await this.getRelationshipHistory(relationshipId, { startDate });

    const analytics: HistoryAnalytics = {
      totalChanges: history.length,
      positiveChanges: 0,
      negativeChanges: 0,
      neutralChanges: 0,
      averageSentiment: 0,
      changesByType: {},
      recentTrend: 'stable',
      significantChanges: 0,
    };

    const { totalSentiment, actorCounts } = this.accumulateHistoryStats(history, analytics);

    analytics.averageSentiment = history.length > 0 ? totalSentiment / history.length : 0;

    if (history.length >= 5) {
      const recent = history.slice(0, 5);
      const recentSentiment =
        recent.reduce((sum, entry) => sum + entry.getSentimentScore(), 0) / recent.length;

      if (recentSentiment > 0.5) {
        analytics.recentTrend = 'improving';
      } else if (recentSentiment < -0.5) {
        analytics.recentTrend = 'declining';
      }
    }

    analytics.mostActiveActor = this.findMostActiveActor(actorCounts);

    return analytics;
  }

  /**
   * Get sentiment trend over time
   */
  async getSentimentTrend(
    relationshipId: string,
    days: number = 90,
    interval: 'day' | 'week' | 'month' = 'week'
  ): Promise<Array<{ period: string; sentiment: number; changeCount: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await this.getRelationshipHistory(relationshipId, {
      startDate,
    });

    // Group by period
    const periodMap = new Map<string, { sentiment: number; count: number }>();

    for (const entry of history) {
      const period = this.getPeriodKey(entry.createdAt, interval);
      const sentiment = entry.getSentimentScore();

      const current = periodMap.get(period);
      if (current) {
        current.sentiment += sentiment;
        current.count++;
      } else {
        periodMap.set(period, { sentiment, count: 1 });
      }
    }

    // Convert to array and calculate averages
    return Array.from(periodMap.entries())
      .map(([period, data]) => ({
        period,
        sentiment: data.count > 0 ? data.sentiment / data.count : 0,
        changeCount: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Get recent significant changes across all relationships
   */
  async getRecentSignificantChanges(
    organizationId: string,
    limit: number = 10
  ): Promise<RelationshipHistory[]> {
    return this.historyRepository
      .createQueryBuilder('history')
      .where('history.organizationId = :organizationId', { organizationId })
      .andWhere('history.isSignificant = :isSignificant', { isSignificant: true })
      .orderBy('history.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Get pending notifications
   */
  async getPendingNotifications(organizationId: string): Promise<RelationshipHistory[]> {
    return this.historyRepository
      .createQueryBuilder('history')
      .where('history.organizationId = :organizationId', { organizationId })
      .andWhere('history.requiresNotification = :requiresNotification', {
        requiresNotification: true,
      })
      .andWhere('history.notificationSent = :notificationSent', {
        notificationSent: false,
      })
      .orderBy('history.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Mark notification as sent
   */
  async markNotificationSent(historyId: string): Promise<void> {
    await this.historyRepository.update(historyId, {
      notificationSent: true,
    });
  }

  /**
   * Get changes made by a specific actor
   */
  async getChangesByActor(
    actorId: string,
    params?: { limit?: number }
  ): Promise<RelationshipHistory[]> {
    const query = this.historyRepository
      .createQueryBuilder('history')
      .where('history.actorId = :actorId', { actorId })
      .orderBy('history.createdAt', 'DESC');

    if (params?.limit) {
      query.take(params.limit);
    }

    return query.getMany();
  }

  /**
   * Helper to get period key for grouping
   */
  private getPeriodKey(date: Date, interval: 'day' | 'week' | 'month'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (interval === 'day') {
      return `${year}-${month}-${day}`;
    } else if (interval === 'week') {
      const weekNum = this.getWeekNumber(date);
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    } else {
      return `${year}-${month}`;
    }
  }

  /**
   * Helper to get week number
   */
  private getWeekNumber(date: Date): number {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + firstDay.getDay() + 1) / 7);
  }

  // ==================== TRUST SCORE MANAGEMENT (consolidated from TrustScoreService) ====================

  /**
   * Update trust score based on an interaction
   */
  async updateTrustScore(
    relationship: OrganizationRelationship,
    adjustment: TrustAdjustment,
    actorId?: string,
    actorName?: string
  ): Promise<number> {
    const oldTrust = relationship.trustScore;
    let newTrust = oldTrust + adjustment.delta;

    // Apply decay factor for extreme scores
    if (newTrust > 80) {
      newTrust = 80 + (newTrust - 80) * 0.5; // Harder to reach 100
    } else if (newTrust < 20) {
      newTrust = 20 + (newTrust - 20) * 0.5; // Harder to reach 0
    }

    // Clamp
    newTrust = Math.max(0, Math.min(100, newTrust));
    relationship.trustScore = newTrust;

    // Update relationship
    await this.relationshipRepository.save(relationship);

    // Record history
    await this.createHistoryEntry({
      relationshipId: relationship.id,
      organizationId: relationship.organizationId,
      targetOrganizationId: relationship.targetOrganizationId,
      changeType: ChangeType.TRUST_UPDATED,
      description: adjustment.reason,
      previousValue: oldTrust,
      newValue: newTrust,
      changeDetails: {
        trustScoreDelta: adjustment.delta,
        sentiment: adjustment.sentiment,
        automated: !actorId,
        customData: adjustment.metadata,
      },
      actorId,
      actorName,
      isSystemGenerated: !actorId,
      isSignificant: Math.abs(adjustment.delta) >= 10,
    });

    return newTrust;
  }

  /**
   * Get trust trend over time
   */
  async getTrustTrend(
    relationshipId: string,
    days: number = 90
  ): Promise<Array<{ date: Date; trust: number; change: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await this.getRelationshipHistory(relationshipId, {
      changeTypes: [ChangeType.TRUST_UPDATED, ChangeType.CREATED],
      startDate,
    });

    return history
      .filter(h => h.newValue !== undefined)
      .map(h => ({
        date: h.createdAt,
        trust: h.newValue as number,
        change: (h.changeDetails?.trustScoreDelta as number) ?? 0,
      }))
      .reverse(); // Oldest first
  }

  /**
   * Get trust recommendations
   */
  getTrustRecommendations(relationship: OrganizationRelationship): TrustRecommendation {
    const trustLevel = relationship.getTrustLevel();
    let suggestions: string[];
    let risks: string[];
    let opportunities: string[];

    // Analyze trust level
    if (relationship.trustScore < 30) {
      suggestions = [
        'Schedule diplomatic meeting to address concerns',
        'Review recent negative interactions',
        'Consider mediator or neutral third party',
      ];
      risks = ['High risk of relationship breakdown', 'Limited cooperation possible'];
      opportunities = [];
    } else if (relationship.trustScore < 50) {
      suggestions = [
        'Increase communication frequency',
        'Start with small collaborative projects',
        'Establish clear expectations and agreements',
      ];
      risks = ['Moderate risk of misunderstandings'];
      opportunities = ['Potential to improve through consistent positive interactions'];
    } else if (relationship.trustScore < 70) {
      suggestions = [
        'Explore deeper cooperation opportunities',
        'Consider resource sharing agreements',
      ];
      risks = [];
      opportunities = ['Good foundation for alliance building', 'Ready for joint operations'];
    } else {
      suggestions = [
        'Maintain current engagement level',
        'Consider formalizing alliance',
        'Explore strategic partnership opportunities',
      ];
      risks = [];
      opportunities = [
        'Excellent foundation for complex cooperation',
        'Consider mutual defense pacts',
      ];
    }

    // Check for specific issues
    if (relationship.negativeInteractions > relationship.positiveInteractions * 2) {
      risks.push('Recent interactions predominantly negative');
      suggestions.push('Urgent review of relationship dynamics needed');
    }

    const daysSinceLastInteraction = relationship.lastInteractionDate
      ? Math.floor(
          (Date.now() - relationship.lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 999;

    if (daysSinceLastInteraction > 90) {
      risks.push('Relationship dormant - trust may decay');
      suggestions.push('Re-establish regular communication');
    }

    // Calculate next review date
    const nextReviewDate = new Date();
    if (relationship.trustScore < 30) {
      nextReviewDate.setDate(nextReviewDate.getDate() + 7); // Weekly for critical
    } else if (relationship.trustScore < 50) {
      nextReviewDate.setDate(nextReviewDate.getDate() + 14); // Bi-weekly for low
    } else if (relationship.trustScore < 70) {
      nextReviewDate.setDate(nextReviewDate.getDate() + 30); // Monthly for moderate
    } else {
      nextReviewDate.setDate(nextReviewDate.getDate() + 90); // Quarterly for high
    }

    return {
      currentLevel: trustLevel,
      suggestedActions: suggestions,
      riskFactors: risks,
      opportunities,
      nextReviewDate,
    };
  }

  /**
   * Apply trust decay for inactive relationships
   */
  async applyTrustDecay(relationship: OrganizationRelationship): Promise<void> {
    if (!relationship.lastInteractionDate) {
      return;
    }

    const daysSinceInteraction = Math.floor(
      (Date.now() - relationship.lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Apply decay after 30 days of inactivity
    if (daysSinceInteraction > 30) {
      const monthsInactive = Math.floor(daysSinceInteraction / 30);
      const decay = monthsInactive * this.TRUST_WEIGHTS.INACTIVITY_PENALTY;

      if (decay < 0) {
        await this.updateTrustScore(relationship, {
          reason: `Trust decay due to ${monthsInactive} month(s) of inactivity`,
          delta: decay,
        });
      }
    }
  }

  /**
   * Bulk apply trust decay to all relationships
   */
  async applyDecayToAll(organizationId: string): Promise<number> {
    const relationships = await this.relationshipRepository.find({
      where: { organizationId },
    });

    let decayed = 0;
    for (const rel of relationships) {
      const oldScore = rel.trustScore;
      await this.applyTrustDecay(rel);

      // Reload to check if changed
      const updated = await this.relationshipRepository.findOne({
        where: { id: rel.id },
      });

      if (updated && updated.trustScore !== oldScore) {
        decayed++;
      }
    }

    return decayed;
  }

  /**
   * Get trust score delta for sentiment
   */
  private getSentimentTrustDelta(sentiment: InteractionSentiment): number {
    switch (sentiment) {
      case InteractionSentiment.VERY_POSITIVE:
        return this.TRUST_WEIGHTS.VERY_POSITIVE_INTERACTION;
      case InteractionSentiment.POSITIVE:
        return this.TRUST_WEIGHTS.POSITIVE_INTERACTION;
      case InteractionSentiment.NEUTRAL:
        return this.TRUST_WEIGHTS.NEUTRAL_INTERACTION;
      case InteractionSentiment.NEGATIVE:
        return this.TRUST_WEIGHTS.NEGATIVE_INTERACTION;
      case InteractionSentiment.VERY_NEGATIVE:
        return this.TRUST_WEIGHTS.VERY_NEGATIVE_INTERACTION;
      default:
        return 0;
    }
  }

  /**
   * Get relationships enriched with target organization name and logo.
   */
  async getOrganizationRelationshipsEnriched(
    organizationId: string,
    filters?: {
      type?: RelationshipType[];
      status?: RelationshipStatus[];
      minTrust?: number;
      maxTrust?: number;
    }
  ): Promise<
    Array<
      OrganizationRelationship & {
        targetOrganization: { id: string; name: string; logoUrl?: string } | null;
      }
    >
  > {
    const relationships = await this.getOrganizationRelationships(organizationId, filters);

    const targetOrgIds = [...new Set(relationships.map(r => r.targetOrganizationId))];
    const orgRepo = AppDataSource.getRepository(Organization);
    const orgs =
      targetOrgIds.length > 0
        ? await orgRepo.find({
            where: { id: In(targetOrgIds) },
            select: ['id', 'name', 'logoUrl'],
          })
        : [];
    const orgMap = new Map(orgs.map(o => [o.id, { id: o.id, name: o.name, logoUrl: o.logoUrl }]));

    return relationships.map(rel =>
      Object.assign(rel, {
        targetOrganization: orgMap.get(rel.targetOrganizationId) ?? null,
      })
    );
  }
}

