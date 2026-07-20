"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelRoutes = void 0;
const express_1 = require("express");
const database_1 = require("../../config/database");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const IntelEntry_1 = require("../../models/IntelEntry");
const IntelOfficer_1 = require("../../models/IntelOfficer");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const schemas_1 = require("../../schemas");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const prototypePollutionPrevention_1 = require("../../utils/prototypePollutionPrevention");
const roleUtils_1 = require("../../utils/roleUtils");
const router = (0, express_1.Router)();
exports.intelRoutes = router;
const CREATE_INTEL_ENTRY_SANITIZE_FIELDS = [
    'title',
    'content',
    'category',
    'classification',
    'tags',
    'relatedEntities',
    'expiresAt',
    'isArchived',
    'location',
    'eventDate',
    'metadata',
];
const UPDATE_INTEL_ENTRY_SANITIZE_FIELDS = [
    'title',
    'content',
    'category',
    'classification',
    'tags',
    'location',
    'eventDate',
    'isArchived',
    'metadata',
];
function getIntelRequestUserId(req) {
    const userId = req.user?.id;
    if (!userId) {
        throw new Error('Authentication required');
    }
    return userId;
}
async function createIntelVaultService() {
    const { IntelVaultService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelVaultService')));
    return new IntelVaultService();
}
async function createIntelSharingService() {
    const { IntelSharingService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelSharingService')));
    return new IntelSharingService();
}
function getRequestMetadata(req) {
    return {
        ipAddress: req.ip ?? req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
    };
}
function getRequestBodyRecord(req) {
    return req.body;
}
function getOptionalReason(req) {
    const body = req.body;
    return typeof body?.reason === 'string' ? body.reason : undefined;
}
function respondTypedApiError(res, error) {
    if (error instanceof apiErrors_1.ApiError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
    }
    return false;
}
router.use('/organizations/:orgId/intel', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext);
router.use('/organizations/:orgId/intel', (req, res, next) => {
    if (req.user?.currentOrganizationId && req.user.currentOrganizationId !== req.params.orgId) {
        res.status(403).json({ error: 'Not authorized for this organization' });
        return;
    }
    next();
});
async function checkIntelAccessFallback(userId, orgId) {
    try {
        const membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const membership = await membershipRepo
            .createQueryBuilder('membership')
            .where('membership.userId = :userId', { userId })
            .andWhere('membership.organizationId = :orgId', { orgId })
            .andWhere('membership.isActive = :isActive', { isActive: true })
            .getOne();
        const roleName = (0, roleUtils_1.getRoleName)(membership?.role);
        if (['owner', 'founder', 'admin'].includes(roleName)) {
            return {
                hasAccess: true,
                accessLevel: 'admin',
                isOwner: roleName === 'owner' || roleName === 'founder',
                isIntelOfficer: false,
            };
        }
    }
    catch (fallbackError) {
        logger_1.logger.error('Intel access fallback also failed', {
            orgId,
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
    }
    return null;
}
router.get('/organizations/:orgId/intel/access', async (req, res) => {
    try {
        const { IntelVaultService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelVaultService')));
        const service = new IntelVaultService();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const result = await service.checkAccess(userId, req.params.orgId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        const userId = req.user?.id;
        const orgId = req.params.orgId;
        if (userId && orgId) {
            const fallback = await checkIntelAccessFallback(userId, orgId);
            if (fallback) {
                logger_1.logger.warn('Intel access check fell back to direct membership lookup', {
                    orgId,
                    userId,
                    error: error instanceof Error ? error.message : String(error),
                });
                res.json({ success: true, data: fallback });
                return;
            }
        }
        logger_1.logger.error('Intel access check failed', {
            orgId: req.params.orgId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to check intel access' });
    }
});
router.get('/organizations/:orgId/intel/entries', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.queryEntries, 'query'), rateLimiting_1.intelOperationsRateLimiter, async (req, res) => {
    try {
        const { IntelVaultService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelVaultService')));
        const service = new IntelVaultService();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const { includeArchived, classification, category, search, limit, offset } = req.query;
        const result = await service.getEntries(req.params.orgId, userId, {
            includeArchived: includeArchived === 'true',
            classification: classification,
            category: category,
            search: search,
            limit: limit ? Number.parseInt(limit, 10) : undefined,
            offset: offset ? Number.parseInt(offset, 10) : undefined,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('access') ||
            message.includes('clearance') ||
            message.includes('permission')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to get intel entries', {
                orgId: req.params.orgId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to get intel entries' });
        }
    }
});
router.get('/organizations/:orgId/intel/entries/:entryId', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.entryIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, async (req, res) => {
    try {
        const { IntelVaultService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelVaultService')));
        const service = new IntelVaultService();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const ipAddress = req.ip ?? req.socket.remoteAddress;
        const userAgent = req.get('user-agent');
        const entry = await service.getEntry(req.params.entryId, userId, req.params.orgId, ipAddress, userAgent);
        res.json({ success: true, data: entry });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found')) {
            res.status(404).json({ success: false, error: 'Intel entry not found' });
        }
        else if (message.includes('clearance') || message.includes('access')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to get intel entry', { entryId: req.params.entryId, error: message });
            res.status(500).json({ error: 'Failed to get intel entry' });
        }
    }
});
router.post('/organizations/:orgId/intel/entries', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.createEntry, 'body'), rateLimiting_1.intelWriteRateLimiter, async (req, res) => {
    try {
        const service = await createIntelVaultService();
        const userId = getIntelRequestUserId(req);
        const { ipAddress, userAgent } = getRequestMetadata(req);
        const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(getRequestBodyRecord(req), CREATE_INTEL_ENTRY_SANITIZE_FIELDS);
        const entry = await service.createEntry({ ...safeBody, organizationId: req.params.orgId }, userId, ipAddress, userAgent);
        res.status(201).json({ success: true, data: entry });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('access') ||
            message.includes('clearance') ||
            message.includes('permission')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to create intel entry', { orgId: req.params.orgId, error: message });
            res.status(500).json({ error: 'Failed to create intel entry' });
        }
    }
});
router.patch('/organizations/:orgId/intel/entries/:entryId', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.entryIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.updateEntry, 'body'), rateLimiting_1.intelWriteRateLimiter, async (req, res) => {
    try {
        const service = await createIntelVaultService();
        const userId = getIntelRequestUserId(req);
        const { ipAddress, userAgent } = getRequestMetadata(req);
        const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(getRequestBodyRecord(req), UPDATE_INTEL_ENTRY_SANITIZE_FIELDS);
        const updated = await service.updateEntry(req.params.entryId, userId, req.params.orgId, safeBody, ipAddress, userAgent);
        res.json({ success: true, data: updated });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('not found')) {
            res.status(404).json({ success: false, error: 'Intel entry not found' });
        }
        else if (message.includes('clearance') ||
            message.includes('access') ||
            message.includes('permission')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to update intel entry', {
                entryId: req.params.entryId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to update intel entry' });
        }
    }
});
router.delete('/organizations/:orgId/intel/entries/:entryId', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.entryIdParam, 'params'), rateLimiting_1.intelDeleteRateLimiter, async (req, res) => {
    try {
        const service = await createIntelVaultService();
        const userId = getIntelRequestUserId(req);
        const { ipAddress, userAgent } = getRequestMetadata(req);
        await service.deleteEntry(req.params.entryId, userId, req.params.orgId, ipAddress, userAgent);
        res.status(204).send();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('not found')) {
            res.status(404).json({ success: false, error: 'Intel entry not found' });
        }
        else if (message.includes('clearance') ||
            message.includes('access') ||
            message.includes('permission')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to delete intel entry', {
                entryId: req.params.entryId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to delete intel entry' });
        }
    }
});
router.post('/organizations/:orgId/intel/entries/:entryId/shares', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.entryIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.createShare, 'body'), rateLimiting_1.intelWriteRateLimiter, async (req, res) => {
    try {
        const service = await createIntelSharingService();
        const userId = getIntelRequestUserId(req);
        const { ipAddress, userAgent } = getRequestMetadata(req);
        const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(getRequestBodyRecord(req), [
            'targetOrganizationId',
            'permission',
            'maxClassification',
            'shareReason',
            'expiresAt',
            'metadata',
        ]);
        const share = await service.createShare({
            intelEntryId: req.params.entryId,
            sourceOrganizationId: req.params.orgId,
            targetOrganizationId: safeBody.targetOrganizationId,
            permission: safeBody.permission,
            maxClassification: safeBody.maxClassification ??
                IntelEntry_1.IntelClassification.RESTRICTED,
            shareReason: safeBody.shareReason,
            expiresAt: safeBody.expiresAt ? new Date(safeBody.expiresAt) : undefined,
            metadata: safeBody.metadata,
        }, userId, ipAddress, userAgent);
        res.status(201).json({ success: true, data: share });
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('not found')) {
            res.status(404).json({ success: false, error: message });
        }
        else if (message.includes('access') || message.includes('permission')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to create intel share', {
                orgId: req.params.orgId,
                entryId: req.params.entryId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to create intel share' });
        }
    }
});
router.get('/organizations/:orgId/intel/entries/:entryId/shares', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.entryIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, async (req, res) => {
    try {
        const service = await createIntelSharingService();
        const userId = getIntelRequestUserId(req);
        const shares = await service.getSharesForEntry(req.params.entryId, req.params.orgId, userId);
        res.json({ success: true, data: shares });
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('permission')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to get intel shares for entry', {
                orgId: req.params.orgId,
                entryId: req.params.entryId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to get intel shares for entry' });
        }
    }
});
router.get('/organizations/:orgId/intel/shares/incoming', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.queryShares, 'query'), rateLimiting_1.intelOperationsRateLimiter, async (req, res) => {
    try {
        const service = await createIntelSharingService();
        const userId = getIntelRequestUserId(req);
        const result = await service.getIntelSharedWithOrg(req.params.orgId, userId, {
            status: req.query.status,
            limit: req.query.limit ? Number.parseInt(req.query.limit, 10) : undefined,
            offset: req.query.offset ? Number.parseInt(req.query.offset, 10) : undefined,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else {
            logger_1.logger.error('Failed to get incoming intel shares', {
                orgId: req.params.orgId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to get incoming intel shares' });
        }
    }
});
router.get('/organizations/:orgId/intel/shares/outgoing', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.queryShares, 'query'), rateLimiting_1.intelOperationsRateLimiter, async (req, res) => {
    try {
        const service = await createIntelSharingService();
        const userId = getIntelRequestUserId(req);
        const result = await service.getIntelSharedByOrg(req.params.orgId, userId, {
            status: req.query.status,
            limit: req.query.limit ? Number.parseInt(req.query.limit, 10) : undefined,
            offset: req.query.offset ? Number.parseInt(req.query.offset, 10) : undefined,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('permission')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to get outgoing intel shares', {
                orgId: req.params.orgId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to get outgoing intel shares' });
        }
    }
});
router.post('/organizations/:orgId/intel/shares/:shareId/accept', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.shareIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.shareResponse, 'body'), rateLimiting_1.intelWriteRateLimiter, async (req, res) => {
    try {
        const service = await createIntelSharingService();
        const userId = getIntelRequestUserId(req);
        const { ipAddress, userAgent } = getRequestMetadata(req);
        const share = await service.acceptShare(req.params.shareId, userId, req.params.orgId, ipAddress, userAgent);
        res.json({ success: true, data: share });
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('not found')) {
            res.status(404).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to accept intel share', {
                shareId: req.params.shareId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to accept intel share' });
        }
    }
});
router.post('/organizations/:orgId/intel/shares/:shareId/decline', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.shareIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.shareResponse, 'body'), rateLimiting_1.intelWriteRateLimiter, async (req, res) => {
    try {
        const service = await createIntelSharingService();
        const userId = getIntelRequestUserId(req);
        const { ipAddress, userAgent } = getRequestMetadata(req);
        const share = await service.declineShare(req.params.shareId, userId, req.params.orgId, getOptionalReason(req), ipAddress, userAgent);
        res.json({ success: true, data: share });
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('not found')) {
            res.status(404).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to decline intel share', {
                shareId: req.params.shareId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to decline intel share' });
        }
    }
});
router.post('/organizations/:orgId/intel/shares/:shareId/revoke', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.shareIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.shareResponse, 'body'), rateLimiting_1.intelWriteRateLimiter, async (req, res) => {
    try {
        const service = await createIntelSharingService();
        const userId = getIntelRequestUserId(req);
        const { ipAddress, userAgent } = getRequestMetadata(req);
        const share = await service.revokeShare(req.params.shareId, userId, req.params.orgId, getOptionalReason(req), ipAddress, userAgent);
        res.json({ success: true, data: share });
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('not found')) {
            res.status(404).json({ success: false, error: message });
        }
        else if (message.includes('permission')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to revoke intel share', {
                shareId: req.params.shareId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to revoke intel share' });
        }
    }
});
router.get('/organizations/:orgId/intel/shared-entries/:entryId', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.entryIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, async (req, res) => {
    try {
        const service = await createIntelSharingService();
        const userId = getIntelRequestUserId(req);
        const { ipAddress, userAgent } = getRequestMetadata(req);
        const data = await service.getSharedEntry(req.params.entryId, userId, req.params.orgId, ipAddress, userAgent);
        res.json({ success: true, data });
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Authentication required') {
            res.status(401).json({ error: message });
        }
        else if (message.includes('not found') || message.includes('expired')) {
            res.status(404).json({ success: false, error: message });
        }
        else if (message.includes('access')) {
            res.status(403).json({ success: false, error: message });
        }
        else {
            logger_1.logger.error('Failed to get shared intel entry', {
                orgId: req.params.orgId,
                entryId: req.params.entryId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to get shared intel entry' });
        }
    }
});
router.get('/organizations/:orgId/intel/officers', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.queryOfficers, 'query'), rateLimiting_1.intelOperationsRateLimiter, async (req, res) => {
    try {
        const { IntelOfficerService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelOfficerService')));
        const service = new IntelOfficerService();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const { includeInactive, rank } = req.query;
        const validRanks = Object.values(IntelOfficer_1.IntelOfficerRank);
        const validatedRank = typeof rank === 'string' && validRanks.includes(rank)
            ? rank
            : undefined;
        const officers = await service.getOfficers(req.params.orgId, userId, {
            includeInactive: includeInactive === 'true',
            rank: validatedRank,
        });
        res.json({ success: true, data: officers });
    }
    catch (error) {
        logger_1.logger.error('Failed to get intel officers', {
            orgId: req.params.orgId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to get intel officers' });
    }
});
router.get('/organizations/:orgId/intel/officers/:officerId', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.officerIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, async (req, res) => {
    try {
        const { IntelOfficerService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelOfficerService')));
        const service = new IntelOfficerService();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const officer = await service.getOfficer(req.params.officerId, userId, req.params.orgId);
        res.json({ success: true, data: officer });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found')) {
            res.status(404).json({ error: 'Intel officer not found' });
        }
        else {
            logger_1.logger.error('Failed to get intel officer', {
                officerId: req.params.officerId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to get intel officer' });
        }
    }
});
router.post('/organizations/:orgId/intel/officers', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.appointOfficer, 'body'), rateLimiting_1.intelOfficerManagementRateLimiter, async (req, res) => {
    try {
        const { IntelOfficerService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelOfficerService')));
        const service = new IntelOfficerService();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const ipAddress = req.ip ?? req.socket.remoteAddress;
        const userAgent = req.get('user-agent');
        const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(getRequestBodyRecord(req), [
            'userId',
            'rank',
            'accessLevel',
            'specializations',
            'notes',
        ]);
        const officer = await service.appointOfficer({ ...safeBody, organizationId: req.params.orgId }, userId, ipAddress, userAgent);
        res.status(201).json({ success: true, data: officer });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('owner') || message.includes('permission')) {
            res.status(403).json({ error: message });
        }
        else {
            logger_1.logger.error('Failed to appoint intel officer', {
                orgId: req.params.orgId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to appoint intel officer' });
        }
    }
});
router.patch('/organizations/:orgId/intel/officers/:officerId', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.officerIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.updateOfficer, 'body'), rateLimiting_1.intelOfficerManagementRateLimiter, async (req, res) => {
    try {
        const { IntelOfficerService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelOfficerService')));
        const service = new IntelOfficerService();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const ipAddress = req.ip ?? req.socket.remoteAddress;
        const userAgent = req.get('user-agent');
        const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(getRequestBodyRecord(req), [
            'rank',
            'accessLevel',
            'specializations',
            'notes',
            'isActive',
        ]);
        const updated = await service.updateOfficer(req.params.officerId, userId, req.params.orgId, safeBody, ipAddress, userAgent);
        res.json({ success: true, data: updated });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found')) {
            res.status(404).json({ error: 'Intel officer not found' });
        }
        else if (message.includes('owner') || message.includes('permission')) {
            res.status(403).json({ error: message });
        }
        else {
            logger_1.logger.error('Failed to update intel officer', {
                officerId: req.params.officerId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to update intel officer' });
        }
    }
});
router.delete('/organizations/:orgId/intel/officers/:officerId', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.officerIdParam, 'params'), rateLimiting_1.intelOfficerManagementRateLimiter, async (req, res) => {
    try {
        const { IntelOfficerService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelOfficerService')));
        const service = new IntelOfficerService();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const ipAddress = req.ip ?? req.socket.remoteAddress;
        const userAgent = req.get('user-agent');
        await service.removeOfficer(req.params.officerId, userId, req.params.orgId, undefined, ipAddress, userAgent);
        res.status(204).send();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found')) {
            res.status(404).json({ error: 'Intel officer not found' });
        }
        else if (message.includes('owner') || message.includes('permission')) {
            res.status(403).json({ error: message });
        }
        else {
            logger_1.logger.error('Failed to remove intel officer', {
                officerId: req.params.officerId,
                error: message,
            });
            res.status(500).json({ error: 'Failed to remove intel officer' });
        }
    }
});
router.get('/organizations/:orgId/intel/audit-logs', (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.intelSchemas.queryAuditLogs, 'query'), rateLimiting_1.intelOperationsRateLimiter, async (req, res) => {
    try {
        const { IntelVaultService } = await Promise.resolve().then(() => __importStar(require('../../services/intel/IntelVaultService')));
        const service = new IntelVaultService();
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const { intelEntryId, action, userId: filterUserId, startDate, endDate, limit, offset, } = req.query;
        const result = await service.getAuditLogs(req.params.orgId, userId, {
            intelEntryId: intelEntryId,
            action: action,
            userId: filterUserId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            limit: limit ? Number.parseInt(limit, 10) : undefined,
            offset: offset ? Number.parseInt(offset, 10) : undefined,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('Failed to get intel audit logs', {
            orgId: req.params.orgId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to get intel audit logs' });
    }
});
//# sourceMappingURL=intel.js.map