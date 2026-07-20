"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipController = void 0;
const OrganizationRelationship_1 = require("../models/OrganizationRelationship");
const RelationshipHistory_1 = require("../models/RelationshipHistory");
const social_1 = require("../services/social");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
class RelationshipController extends BaseController_1.BaseController {
    relationshipService;
    constructor() {
        super();
        this.relationshipService = new social_1.RelationshipService();
    }
    createRelationship = async (req, res) => {
        await this.execute(req, res, async () => {
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const { targetOrganizationId, type, status, description, notes, tags, contactName, contactRole, contactEmail, metadata, } = req.body;
            const organizationId = tenantOrgId;
            if (!organizationId) {
                throw new apiErrors_1.ForbiddenError('Organization context required');
            }
            const actorId = userReq.user?.id;
            const actorName = userReq.user?.username;
            const relationship = await this.relationshipService.createRelationship({
                organizationId,
                targetOrganizationId,
                type,
                status,
                description,
                notes,
                tags,
                contactName,
                contactRole,
                contactEmail,
                establishedById: actorId,
                establishedByName: actorName,
                metadata,
            });
            res.status(201).json({
                success: true,
                data: relationship,
                message: 'Relationship created successfully',
            });
        });
    };
    getRelationship = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const relationship = await this.relationshipService.getRelationshipById(id);
            if (!relationship) {
                throw new apiErrors_1.NotFoundError('Relationship');
            }
            if (tenantOrgId && relationship.organizationId !== tenantOrgId) {
                throw new apiErrors_1.ForbiddenError('Access denied to this relationship');
            }
            res.json({
                success: true,
                data: relationship,
            });
        });
    };
    getOrganizationRelationships = async (req, res) => {
        await this.execute(req, res, async () => {
            const { orgId } = req.params;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            if (tenantOrgId && orgId !== tenantOrgId) {
                throw new apiErrors_1.ForbiddenError("Access denied to this organization's relationships");
            }
            const { type, status, minTrust, maxTrust } = req.query;
            const filters = {};
            if (type) {
                filters.type = Array.isArray(type) ? type : [type];
            }
            if (status) {
                filters.status = Array.isArray(status) ? status : [status];
            }
            if (minTrust) {
                filters.minTrust = Number.parseFloat(minTrust);
            }
            if (maxTrust) {
                filters.maxTrust = Number.parseFloat(maxTrust);
            }
            const enriched = await this.relationshipService.getOrganizationRelationshipsEnriched(orgId, filters);
            res.json({
                success: true,
                data: enriched,
                count: enriched.length,
            });
        });
    };
    updateRelationship = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const actorId = userReq.user?.id;
            const actorName = userReq.user?.username;
            if (tenantOrgId) {
                const existing = await this.relationshipService.getRelationshipById(id);
                if (!existing) {
                    throw new apiErrors_1.NotFoundError('Relationship');
                }
                if (existing.organizationId !== tenantOrgId) {
                    throw new apiErrors_1.ForbiddenError('Access denied to this relationship');
                }
            }
            const relationship = await this.relationshipService.updateRelationship(id, req.body, actorId, actorName);
            res.json({
                success: true,
                data: relationship,
                message: 'Relationship updated successfully',
            });
        });
    };
    getRelationshipHistory = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { changeType, startDate, endDate, limit, offset } = req.query;
            const params = {};
            if (changeType) {
                params.changeType = Array.isArray(changeType) ? changeType : [changeType];
            }
            if (startDate) {
                params.startDate = new Date(startDate);
            }
            if (endDate) {
                params.endDate = new Date(endDate);
            }
            if (limit) {
                params.limit = Math.min(Number.parseInt(limit), 200);
            }
            if (offset) {
                params.offset = Number.parseInt(offset);
            }
            const history = await this.relationshipService.getRelationshipHistory(id, params);
            const detailedHistory = history.map((entry) => entry.getDetailedSummary());
            res.json({
                success: true,
                data: detailedHistory,
                count: detailedHistory.length,
            });
        });
    };
    getRelationshipTimeline = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const existing = await this.relationshipService.getRelationshipById(id, tenantOrgId);
            if (!existing) {
                throw new apiErrors_1.NotFoundError('Relationship');
            }
            const timeline = await this.relationshipService.getRelationshipTimeline(id);
            res.json({
                success: true,
                data: timeline,
            });
        });
    };
    getRelationshipAnalytics = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { days } = req.query;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const existing = await this.relationshipService.getRelationshipById(id, tenantOrgId);
            if (!existing) {
                throw new apiErrors_1.NotFoundError('Relationship');
            }
            const analyticsDays = days ? Number.parseInt(days) : 30;
            const analytics = await this.relationshipService.analyzeRelationshipHistory(id, analyticsDays);
            res.json({
                success: true,
                data: analytics,
            });
        });
    };
    getSentimentTrend = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { days, interval } = req.query;
            const trendDays = days ? Number.parseInt(days) : 90;
            const trendInterval = interval || 'day';
            const trend = await this.relationshipService.getSentimentTrend(id, trendDays, trendInterval);
            res.json({
                success: true,
                data: trend,
            });
        });
    };
    recordInteraction = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { description, sentiment } = req.body;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const actorId = userReq.user?.id;
            const actorName = userReq.user?.username;
            if (tenantOrgId) {
                const existing = await this.relationshipService.getRelationshipById(id);
                if (!existing) {
                    throw new apiErrors_1.NotFoundError('Relationship');
                }
                if (existing.organizationId !== tenantOrgId) {
                    throw new apiErrors_1.ForbiddenError('Access denied to this relationship');
                }
            }
            const relationship = await this.relationshipService.recordInteraction({
                relationshipId: id,
                description,
                sentiment,
                actorId,
                actorName,
            });
            res.status(201).json({
                success: true,
                data: relationship,
                message: 'Interaction recorded successfully',
            });
        });
    };
    updateTrustScore = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { delta, reason, metadata } = req.body;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const actorId = userReq.user?.id;
            const actorName = userReq.user?.username;
            const relationship = await this.relationshipService.getRelationshipById(id);
            if (!relationship) {
                throw new apiErrors_1.NotFoundError('Relationship');
            }
            if (tenantOrgId && relationship.organizationId !== tenantOrgId) {
                throw new apiErrors_1.ForbiddenError('Access denied to this relationship');
            }
            const newTrust = await this.relationshipService.updateTrustScore(relationship, { reason, delta, metadata }, actorId, actorName);
            res.json({
                success: true,
                data: {
                    relationshipId: id,
                    trustScore: newTrust,
                    change: delta,
                },
                message: 'Trust score updated successfully',
            });
        });
    };
    getTrustHistory = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { days } = req.query;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const existing = await this.relationshipService.getRelationshipById(id, tenantOrgId);
            if (!existing) {
                throw new apiErrors_1.NotFoundError('Relationship');
            }
            const historyDays = days ? Number.parseInt(days) : 90;
            const trustTrend = await this.relationshipService.getTrustTrend(id, historyDays);
            res.json({
                success: true,
                data: trustTrend,
            });
        });
    };
    getTrustRecommendations = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const relationship = await this.relationshipService.getRelationshipById(id, tenantOrgId);
            if (!relationship) {
                throw new apiErrors_1.NotFoundError('Relationship');
            }
            const recommendations = this.relationshipService.getTrustRecommendations(relationship);
            res.json({
                success: true,
                data: recommendations,
            });
        });
    };
    getRelationshipHealthSummary = async (req, res) => {
        await this.execute(req, res, async () => {
            const { orgId } = req.params;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            if (tenantOrgId && orgId !== tenantOrgId) {
                throw new apiErrors_1.ForbiddenError("Access denied to this organization's relationships");
            }
            const summary = await this.relationshipService.getRelationshipHealthSummary(orgId);
            res.json({
                success: true,
                data: summary,
            });
        });
    };
    getRelationshipsNeedingReview = async (req, res) => {
        await this.execute(req, res, async () => {
            const { orgId } = req.params;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            if (tenantOrgId && orgId !== tenantOrgId) {
                throw new apiErrors_1.ForbiddenError("Access denied to this organization's relationships");
            }
            const relationships = await this.relationshipService.getRelationshipsNeedingReview(orgId);
            res.json({
                success: true,
                data: relationships,
                count: relationships.length,
            });
        });
    };
    establishMutualRelationship = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const actorId = userReq.user?.id;
            const actorName = userReq.user?.username;
            if (tenantOrgId) {
                const existing = await this.relationshipService.getRelationshipById(id);
                if (!existing) {
                    throw new apiErrors_1.NotFoundError('Relationship');
                }
                if (existing.organizationId !== tenantOrgId) {
                    throw new apiErrors_1.ForbiddenError('Access denied to this relationship');
                }
            }
            await this.relationshipService.establishMutualRelationship(id, actorId, actorName);
            res.json({
                success: true,
                message: 'Mutual relationship established successfully',
            });
        });
    };
    terminateRelationship = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { reason } = req.body;
            const userReq = req;
            const tenantOrgId = userReq.tenantContext?.organizationId;
            const actorId = userReq.user?.id;
            const actorName = userReq.user?.username;
            if (tenantOrgId) {
                const existing = await this.relationshipService.getRelationshipById(id);
                if (!existing) {
                    throw new apiErrors_1.NotFoundError('Relationship');
                }
                if (existing.organizationId !== tenantOrgId) {
                    throw new apiErrors_1.ForbiddenError('Access denied to this relationship');
                }
            }
            await this.relationshipService.terminateRelationship(id, reason, actorId, actorName);
            res.json({
                success: true,
                message: 'Relationship terminated successfully',
            });
        });
    };
    getRelationshipTypes = async (req, res) => {
        await this.execute(req, res, async () => {
            res.json({
                success: true,
                data: Object.values(OrganizationRelationship_1.RelationshipType),
            });
        });
    };
    getChangeTypes = async (req, res) => {
        await this.execute(req, res, async () => {
            res.json({
                success: true,
                data: Object.values(RelationshipHistory_1.ChangeType),
            });
        });
    };
    getInteractionSentiments = async (req, res) => {
        await this.execute(req, res, async () => {
            res.json({
                success: true,
                data: Object.values(RelationshipHistory_1.InteractionSentiment),
            });
        });
    };
}
exports.RelationshipController = RelationshipController;
//# sourceMappingURL=relationshipController.js.map