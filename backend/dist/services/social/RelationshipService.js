"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
const RelationshipHistory_1 = require("../../models/RelationshipHistory");
class RelationshipService {
    relationshipRepository;
    historyRepository;
    TRUST_WEIGHTS = {
        VERY_POSITIVE_INTERACTION: 5,
        POSITIVE_INTERACTION: 2,
        NEUTRAL_INTERACTION: 0,
        NEGATIVE_INTERACTION: -3,
        VERY_NEGATIVE_INTERACTION: -8,
        INACTIVITY_PENALTY: -2,
    };
    TYPE_BONUSES = {
        [OrganizationRelationship_1.RelationshipType.ALLIED]: 15,
        [OrganizationRelationship_1.RelationshipType.PARTNERSHIP]: 12,
        [OrganizationRelationship_1.RelationshipType.COOPERATIVE]: 8,
        [OrganizationRelationship_1.RelationshipType.AFFILIATED]: 5,
        [OrganizationRelationship_1.RelationshipType.TRADING_PARTNER]: 5,
        [OrganizationRelationship_1.RelationshipType.NEUTRAL]: 0,
        [OrganizationRelationship_1.RelationshipType.OBSERVER]: 0,
        [OrganizationRelationship_1.RelationshipType.INTERESTED]: 2,
        [OrganizationRelationship_1.RelationshipType.COMPETITIVE]: -5,
        [OrganizationRelationship_1.RelationshipType.RIVAL]: -10,
        [OrganizationRelationship_1.RelationshipType.HOSTILE]: -15,
        [OrganizationRelationship_1.RelationshipType.WAR]: -25,
    };
    constructor(relationshipRepository, historyRepository) {
        this.relationshipRepository =
            relationshipRepository ?? data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
        this.historyRepository = historyRepository ?? data_source_1.AppDataSource.getRepository(RelationshipHistory_1.RelationshipHistory);
    }
    calculateTrustScore(params) {
        let score = params.currentTrust;
        const typeBonus = this.TYPE_BONUSES[params.relationshipType] || 0;
        score += typeBonus;
        if (params.interactionHistory.total > 0) {
            const positiveRatio = params.interactionHistory.positive / params.interactionHistory.total;
            const negativeRatio = params.interactionHistory.negative / params.interactionHistory.total;
            const interactionModifier = positiveRatio * 15 - negativeRatio * 20;
            score += interactionModifier;
        }
        if (params.durationDays > 0) {
            const durationBonus = Math.min(10, params.durationDays / 36.5);
            score += durationBonus;
        }
        if (params.recentActivity > 0) {
            score += Math.min(5, params.recentActivity / 20);
        }
        return Math.max(0, Math.min(100, score));
    }
    async createRelationship(params) {
        const existing = await this.relationshipRepository.findOne({
            where: {
                organizationId: params.organizationId,
                targetOrganizationId: params.targetOrganizationId,
            },
        });
        if (existing) {
            throw new Error('Relationship already exists');
        }
        const relationship = this.relationshipRepository.create({
            organizationId: params.organizationId,
            targetOrganizationId: params.targetOrganizationId,
            type: params.type,
            status: params.status ?? OrganizationRelationship_1.RelationshipStatus.ACTIVE,
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
            trustScore: 50,
            relationshipStrength: 25,
            interactionCount: 0,
            positiveInteractions: 0,
            negativeInteractions: 0,
        });
        const saved = await this.relationshipRepository.save(relationship);
        await this.createHistoryEntry({
            relationshipId: saved.id,
            organizationId: saved.organizationId,
            targetOrganizationId: saved.targetOrganizationId,
            changeType: RelationshipHistory_1.ChangeType.CREATED,
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
    applyRelationshipUpdates(relationship, params) {
        const changes = [];
        if (params.type && params.type !== relationship.type) {
            changes.push({
                type: RelationshipHistory_1.ChangeType.TYPE_CHANGED,
                old: relationship.type,
                new: params.type,
                description: `Relationship type changed from ${relationship.type} to ${params.type}`,
            });
            relationship.type = params.type;
        }
        if (params.status && params.status !== relationship.status) {
            changes.push({
                type: RelationshipHistory_1.ChangeType.STATUS_CHANGED,
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
                    type: RelationshipHistory_1.ChangeType.NOTES_UPDATED,
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
                type: RelationshipHistory_1.ChangeType.METADATA_UPDATED,
                old: relationship.metadata,
                new: params.metadata,
                description: 'Metadata updated',
            });
            relationship.metadata = params.metadata;
        }
        return changes;
    }
    applyContactUpdates(relationship, params, changes) {
        if (params.contactName !== undefined ||
            params.contactRole !== undefined ||
            params.contactEmail !== undefined) {
            changes.push({
                type: RelationshipHistory_1.ChangeType.CONTACT_UPDATED,
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
                    type: RelationshipHistory_1.ChangeType.CONTACT_UPDATED,
                    old: oldChannels,
                    new: params.communicationChannels,
                    description: 'Communication channels updated',
                });
            }
        }
    }
    applyAgreementUpdates(relationship, params, changes) {
        if (params.reviewDate !== undefined) {
            relationship.reviewDate = params.reviewDate ? new Date(params.reviewDate) : undefined;
        }
        if (params.expiryDate !== undefined) {
            relationship.expiryDate = params.expiryDate ? new Date(params.expiryDate) : undefined;
        }
        if (params.isPublic !== undefined && params.isPublic !== relationship.isPublic) {
            changes.push({
                type: RelationshipHistory_1.ChangeType.STATUS_CHANGED,
                old: relationship.isPublic,
                new: params.isPublic,
                description: `Visibility changed to ${params.isPublic ? 'public' : 'private'}`,
            });
            relationship.isPublic = params.isPublic;
        }
        if (params.autoRenew !== undefined && params.autoRenew !== relationship.autoRenew) {
            changes.push({
                type: RelationshipHistory_1.ChangeType.METADATA_UPDATED,
                old: relationship.autoRenew,
                new: params.autoRenew,
                description: `Auto-renew ${params.autoRenew ? 'enabled' : 'disabled'}`,
            });
            relationship.autoRenew = params.autoRenew;
        }
    }
    async updateRelationship(relationshipId, params, actorId, actorName, organizationId) {
        const where = { id: relationshipId };
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
                isSignificant: change.type === RelationshipHistory_1.ChangeType.TYPE_CHANGED || change.type === RelationshipHistory_1.ChangeType.STATUS_CHANGED,
            });
        }
        return updated;
    }
    async recordInteraction(params) {
        const where = { id: params.relationshipId };
        if (params.organizationId) {
            where.organizationId = params.organizationId;
        }
        const relationship = await this.relationshipRepository.findOne({ where });
        if (!relationship) {
            throw new Error('Relationship not found');
        }
        relationship.interactionCount++;
        if (params.sentiment === RelationshipHistory_1.InteractionSentiment.VERY_POSITIVE ||
            params.sentiment === RelationshipHistory_1.InteractionSentiment.POSITIVE) {
            relationship.positiveInteractions++;
        }
        else if (params.sentiment === RelationshipHistory_1.InteractionSentiment.VERY_NEGATIVE ||
            params.sentiment === RelationshipHistory_1.InteractionSentiment.NEGATIVE) {
            relationship.negativeInteractions++;
        }
        const delta = this.getSentimentTrustDelta(params.sentiment);
        await this.updateTrustScore(relationship, {
            reason: params.description,
            delta,
            sentiment: params.sentiment,
            metadata: params.metadata,
        }, params.actorId, params.actorName);
        await this.createHistoryEntry({
            relationshipId: relationship.id,
            organizationId: relationship.organizationId,
            targetOrganizationId: relationship.targetOrganizationId,
            changeType: RelationshipHistory_1.ChangeType.INTERACTION_RECORDED,
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
            isSignificant: params.sentiment === RelationshipHistory_1.InteractionSentiment.VERY_POSITIVE ||
                params.sentiment === RelationshipHistory_1.InteractionSentiment.VERY_NEGATIVE,
        });
        const strengthDelta = this.calculateStrengthDelta(params.sentiment);
        relationship.relationshipStrength = Math.max(0, Math.min(100, relationship.relationshipStrength + strengthDelta));
        relationship.lastInteractionDate = new Date();
        return this.relationshipRepository.save(relationship);
    }
    async establishMutualRelationship(relationshipId, actorId, actorName) {
        const relationship = await this.relationshipRepository.findOne({
            where: { id: relationshipId },
        });
        if (!relationship) {
            throw new Error('Relationship not found');
        }
        const reverse = await this.relationshipRepository.findOne({
            where: {
                organizationId: relationship.targetOrganizationId,
                targetOrganizationId: relationship.organizationId,
            },
        });
        if (!reverse) {
            throw new Error('Reverse relationship does not exist');
        }
        relationship.isMutuallyRecognized = true;
        reverse.isMutuallyRecognized = true;
        await this.relationshipRepository.save([relationship, reverse]);
        await this.createHistoryEntry({
            relationshipId: relationship.id,
            organizationId: relationship.organizationId,
            targetOrganizationId: relationship.targetOrganizationId,
            changeType: RelationshipHistory_1.ChangeType.MUTUAL_ESTABLISHED,
            description: 'Mutual relationship established',
            newValue: true,
            actorId,
            actorName,
            isSignificant: true,
            requiresNotification: true,
        });
    }
    async getRelationshipById(relationshipId, organizationId) {
        const where = { id: relationshipId };
        if (organizationId) {
            where.organizationId = organizationId;
        }
        return this.relationshipRepository.findOne({ where });
    }
    async getOrganizationRelationships(organizationId, filters) {
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
    async getRelationshipsNeedingReview(organizationId) {
        const relationships = await this.getOrganizationRelationships(organizationId, {
            status: [OrganizationRelationship_1.RelationshipStatus.ACTIVE],
        });
        return relationships.filter(rel => rel.needsReview());
    }
    async getRelationshipHealthSummary(organizationId) {
        const relationships = await this.getOrganizationRelationships(organizationId);
        const summary = {
            total: relationships.length,
            byStatus: {},
            byType: {},
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
            summary.byStatus[rel.status] = (summary.byStatus[rel.status] || 0) + 1;
            summary.byType[rel.type] = (summary.byType[rel.type] || 0) + 1;
            const tier = rel.getRelationshipTier();
            summary.byHealth[tier]++;
            totalTrust += rel.trustScore;
            totalStrength += rel.relationshipStrength;
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
    async terminateRelationship(relationshipId, reason, actorId, actorName, organizationId) {
        const where = { id: relationshipId };
        if (organizationId) {
            where.organizationId = organizationId;
        }
        const relationship = await this.relationshipRepository.findOne({ where });
        if (!relationship) {
            throw new Error('Relationship not found');
        }
        relationship.status = OrganizationRelationship_1.RelationshipStatus.TERMINATED;
        await this.relationshipRepository.save(relationship);
        await this.createHistoryEntry({
            relationshipId: relationship.id,
            organizationId: relationship.organizationId,
            targetOrganizationId: relationship.targetOrganizationId,
            changeType: RelationshipHistory_1.ChangeType.TERMINATED,
            description: 'Relationship terminated',
            previousValue: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
            newValue: OrganizationRelationship_1.RelationshipStatus.TERMINATED,
            reason,
            actorId,
            actorName,
            isSignificant: true,
            requiresNotification: true,
        });
    }
    calculateStrengthDelta(sentiment) {
        switch (sentiment) {
            case RelationshipHistory_1.InteractionSentiment.VERY_POSITIVE:
                return 3;
            case RelationshipHistory_1.InteractionSentiment.POSITIVE:
                return 1.5;
            case RelationshipHistory_1.InteractionSentiment.NEUTRAL:
                return 0.5;
            case RelationshipHistory_1.InteractionSentiment.NEGATIVE:
                return -2;
            case RelationshipHistory_1.InteractionSentiment.VERY_NEGATIVE:
                return -5;
            default:
                return 0;
        }
    }
    async createHistoryEntry(params) {
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
    async getRelationshipHistory(relationshipId, params) {
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
        let filtered = results;
        if (params?.onlyPositive) {
            filtered = filtered.filter(h => h.isPositiveChange());
        }
        if (params?.onlyNegative) {
            filtered = filtered.filter(h => h.isNegativeChange());
        }
        return filtered;
    }
    async getOrganizationHistory(organizationId, params) {
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
    async getRelationshipTimeline(relationshipId) {
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
    accumulateHistoryStats(history, analytics) {
        let totalSentiment = 0;
        const actorCounts = new Map();
        for (const entry of history) {
            if (entry.isPositiveChange()) {
                analytics.positiveChanges++;
            }
            else if (entry.isNegativeChange()) {
                analytics.negativeChanges++;
            }
            else {
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
                }
                else {
                    actorCounts.set(entry.actorId, { name: entry.actorName, count: 1 });
                }
            }
        }
        return { totalSentiment, actorCounts };
    }
    findMostActiveActor(actorCounts) {
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
    async analyzeRelationshipHistory(relationshipId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const history = await this.getRelationshipHistory(relationshipId, { startDate });
        const analytics = {
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
            const recentSentiment = recent.reduce((sum, entry) => sum + entry.getSentimentScore(), 0) / recent.length;
            if (recentSentiment > 0.5) {
                analytics.recentTrend = 'improving';
            }
            else if (recentSentiment < -0.5) {
                analytics.recentTrend = 'declining';
            }
        }
        analytics.mostActiveActor = this.findMostActiveActor(actorCounts);
        return analytics;
    }
    async getSentimentTrend(relationshipId, days = 90, interval = 'week') {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const history = await this.getRelationshipHistory(relationshipId, {
            startDate,
        });
        const periodMap = new Map();
        for (const entry of history) {
            const period = this.getPeriodKey(entry.createdAt, interval);
            const sentiment = entry.getSentimentScore();
            const current = periodMap.get(period);
            if (current) {
                current.sentiment += sentiment;
                current.count++;
            }
            else {
                periodMap.set(period, { sentiment, count: 1 });
            }
        }
        return Array.from(periodMap.entries())
            .map(([period, data]) => ({
            period,
            sentiment: data.count > 0 ? data.sentiment / data.count : 0,
            changeCount: data.count,
        }))
            .sort((a, b) => a.period.localeCompare(b.period));
    }
    async getRecentSignificantChanges(organizationId, limit = 10) {
        return this.historyRepository
            .createQueryBuilder('history')
            .where('history.organizationId = :organizationId', { organizationId })
            .andWhere('history.isSignificant = :isSignificant', { isSignificant: true })
            .orderBy('history.createdAt', 'DESC')
            .take(limit)
            .getMany();
    }
    async getPendingNotifications(organizationId) {
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
    async markNotificationSent(historyId) {
        await this.historyRepository.update(historyId, {
            notificationSent: true,
        });
    }
    async getChangesByActor(actorId, params) {
        const query = this.historyRepository
            .createQueryBuilder('history')
            .where('history.actorId = :actorId', { actorId })
            .orderBy('history.createdAt', 'DESC');
        if (params?.limit) {
            query.take(params.limit);
        }
        return query.getMany();
    }
    getPeriodKey(date, interval) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        if (interval === 'day') {
            return `${year}-${month}-${day}`;
        }
        else if (interval === 'week') {
            const weekNum = this.getWeekNumber(date);
            return `${year}-W${String(weekNum).padStart(2, '0')}`;
        }
        else {
            return `${year}-${month}`;
        }
    }
    getWeekNumber(date) {
        const firstDay = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + firstDay.getDay() + 1) / 7);
    }
    async updateTrustScore(relationship, adjustment, actorId, actorName) {
        const oldTrust = relationship.trustScore;
        let newTrust = oldTrust + adjustment.delta;
        if (newTrust > 80) {
            newTrust = 80 + (newTrust - 80) * 0.5;
        }
        else if (newTrust < 20) {
            newTrust = 20 + (newTrust - 20) * 0.5;
        }
        newTrust = Math.max(0, Math.min(100, newTrust));
        relationship.trustScore = newTrust;
        await this.relationshipRepository.save(relationship);
        await this.createHistoryEntry({
            relationshipId: relationship.id,
            organizationId: relationship.organizationId,
            targetOrganizationId: relationship.targetOrganizationId,
            changeType: RelationshipHistory_1.ChangeType.TRUST_UPDATED,
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
    async getTrustTrend(relationshipId, days = 90) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const history = await this.getRelationshipHistory(relationshipId, {
            changeTypes: [RelationshipHistory_1.ChangeType.TRUST_UPDATED, RelationshipHistory_1.ChangeType.CREATED],
            startDate,
        });
        return history
            .filter(h => h.newValue !== undefined)
            .map(h => ({
            date: h.createdAt,
            trust: h.newValue,
            change: h.changeDetails?.trustScoreDelta ?? 0,
        }))
            .reverse();
    }
    getTrustRecommendations(relationship) {
        const trustLevel = relationship.getTrustLevel();
        let suggestions;
        let risks;
        let opportunities;
        if (relationship.trustScore < 30) {
            suggestions = [
                'Schedule diplomatic meeting to address concerns',
                'Review recent negative interactions',
                'Consider mediator or neutral third party',
            ];
            risks = ['High risk of relationship breakdown', 'Limited cooperation possible'];
            opportunities = [];
        }
        else if (relationship.trustScore < 50) {
            suggestions = [
                'Increase communication frequency',
                'Start with small collaborative projects',
                'Establish clear expectations and agreements',
            ];
            risks = ['Moderate risk of misunderstandings'];
            opportunities = ['Potential to improve through consistent positive interactions'];
        }
        else if (relationship.trustScore < 70) {
            suggestions = [
                'Explore deeper cooperation opportunities',
                'Consider resource sharing agreements',
            ];
            risks = [];
            opportunities = ['Good foundation for alliance building', 'Ready for joint operations'];
        }
        else {
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
        if (relationship.negativeInteractions > relationship.positiveInteractions * 2) {
            risks.push('Recent interactions predominantly negative');
            suggestions.push('Urgent review of relationship dynamics needed');
        }
        const daysSinceLastInteraction = relationship.lastInteractionDate
            ? Math.floor((Date.now() - relationship.lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24))
            : 999;
        if (daysSinceLastInteraction > 90) {
            risks.push('Relationship dormant - trust may decay');
            suggestions.push('Re-establish regular communication');
        }
        const nextReviewDate = new Date();
        if (relationship.trustScore < 30) {
            nextReviewDate.setDate(nextReviewDate.getDate() + 7);
        }
        else if (relationship.trustScore < 50) {
            nextReviewDate.setDate(nextReviewDate.getDate() + 14);
        }
        else if (relationship.trustScore < 70) {
            nextReviewDate.setDate(nextReviewDate.getDate() + 30);
        }
        else {
            nextReviewDate.setDate(nextReviewDate.getDate() + 90);
        }
        return {
            currentLevel: trustLevel,
            suggestedActions: suggestions,
            riskFactors: risks,
            opportunities,
            nextReviewDate,
        };
    }
    async applyTrustDecay(relationship) {
        if (!relationship.lastInteractionDate) {
            return;
        }
        const daysSinceInteraction = Math.floor((Date.now() - relationship.lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24));
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
    async applyDecayToAll(organizationId) {
        const relationships = await this.relationshipRepository.find({
            where: { organizationId },
        });
        let decayed = 0;
        for (const rel of relationships) {
            const oldScore = rel.trustScore;
            await this.applyTrustDecay(rel);
            const updated = await this.relationshipRepository.findOne({
                where: { id: rel.id },
            });
            if (updated && updated.trustScore !== oldScore) {
                decayed++;
            }
        }
        return decayed;
    }
    getSentimentTrustDelta(sentiment) {
        switch (sentiment) {
            case RelationshipHistory_1.InteractionSentiment.VERY_POSITIVE:
                return this.TRUST_WEIGHTS.VERY_POSITIVE_INTERACTION;
            case RelationshipHistory_1.InteractionSentiment.POSITIVE:
                return this.TRUST_WEIGHTS.POSITIVE_INTERACTION;
            case RelationshipHistory_1.InteractionSentiment.NEUTRAL:
                return this.TRUST_WEIGHTS.NEUTRAL_INTERACTION;
            case RelationshipHistory_1.InteractionSentiment.NEGATIVE:
                return this.TRUST_WEIGHTS.NEGATIVE_INTERACTION;
            case RelationshipHistory_1.InteractionSentiment.VERY_NEGATIVE:
                return this.TRUST_WEIGHTS.VERY_NEGATIVE_INTERACTION;
            default:
                return 0;
        }
    }
    async getOrganizationRelationshipsEnriched(organizationId, filters) {
        const relationships = await this.getOrganizationRelationships(organizationId, filters);
        const targetOrgIds = [...new Set(relationships.map(r => r.targetOrganizationId))];
        const orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        const orgs = targetOrgIds.length > 0
            ? await orgRepo.find({
                where: { id: (0, typeorm_1.In)(targetOrgIds) },
                select: ['id', 'name', 'logoUrl'],
            })
            : [];
        const orgMap = new Map(orgs.map(o => [o.id, { id: o.id, name: o.name, logoUrl: o.logoUrl }]));
        return relationships.map(rel => Object.assign(rel, {
            targetOrganization: orgMap.get(rel.targetOrganizationId) ?? null,
        }));
    }
}
exports.RelationshipService = RelationshipService;
//# sourceMappingURL=RelationshipService.js.map