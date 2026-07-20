"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelControllerV2 = void 0;
const IntelVisibilityService_1 = require("../../services/intel/IntelVisibilityService");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
async function getIntelEntries(req, res) {
    try {
        const organizationId = req.organization?.id;
        const userId = req.user?.id;
        if (!organizationId || !userId) {
            res.status(401).json({
                error: {
                    code: apiErrors_1.ApiErrorCode.UNAUTHORIZED,
                    message: 'User and organization context required',
                },
            });
            return;
        }
        const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const search = req.query.search;
        const result = await IntelVisibilityService_1.intelVisibilityService.getVisibleIntelEntries(organizationId, userId, {
            limit,
            offset,
            search,
        });
        res.json({
            data: result.entries,
            pagination: {
                total: result.total,
                count: result.entries.length,
                limit,
                offset,
                hasMore: offset + result.entries.length < result.total,
            },
        });
    }
    catch (error) {
        if (error instanceof apiErrors_1.ApiError) {
            res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
            return;
        }
        logger_1.logger.error('Error fetching intel entries', error);
        res.status(500).json({
            error: {
                code: apiErrors_1.ApiErrorCode.INTERNAL_ERROR,
                message: 'Failed to fetch intel entries',
            },
        });
    }
}
async function getIntelEntry(req, res) {
    try {
        const organizationId = req.organization?.id;
        const userId = req.user?.id;
        const { id } = req.params;
        if (!organizationId || !userId) {
            res.status(401).json({
                error: {
                    code: apiErrors_1.ApiErrorCode.UNAUTHORIZED,
                    message: 'User and organization context required',
                },
            });
            return;
        }
        const intel = await IntelVisibilityService_1.intelVisibilityService.getIntelDetails(id, organizationId, userId);
        res.json({ data: intel });
    }
    catch (error) {
        if (error instanceof apiErrors_1.ForbiddenError) {
            res.status(403).json({
                error: {
                    code: apiErrors_1.ApiErrorCode.FORBIDDEN,
                    message: error.message,
                },
            });
            return;
        }
        if (error instanceof apiErrors_1.ApiError) {
            res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
            return;
        }
        logger_1.logger.error('Error fetching intel entry', error);
        res.status(500).json({
            error: {
                code: apiErrors_1.ApiErrorCode.INTERNAL_ERROR,
                message: 'Failed to fetch intel entry',
            },
        });
    }
}
async function updateIntelVisibility(req, res) {
    try {
        const organizationId = req.organization?.id;
        const userId = req.user?.id;
        const { id } = req.params;
        const { visibility } = req.body;
        if (!organizationId || !userId) {
            res.status(401).json({
                error: {
                    code: apiErrors_1.ApiErrorCode.UNAUTHORIZED,
                    message: 'User and organization context required',
                },
            });
            return;
        }
        if (!Object.values(IntelVisibilityService_1.IntelVisibilityLevel).includes(visibility)) {
            res.status(400).json({
                error: {
                    code: apiErrors_1.ApiErrorCode.VALIDATION_ERROR,
                    message: 'Invalid visibility level',
                    details: {
                        visibility: ['Must be one of: PUBLIC, ORG, PRIVATE'],
                    },
                },
            });
            return;
        }
        const updated = await IntelVisibilityService_1.intelVisibilityService.updateIntelVisibility(id, organizationId, userId, visibility);
        res.json({
            data: updated,
            message: 'Intel visibility updated',
        });
    }
    catch (error) {
        if (error instanceof apiErrors_1.ForbiddenError) {
            res.status(403).json({
                error: {
                    code: apiErrors_1.ApiErrorCode.FORBIDDEN,
                    message: error.message,
                },
            });
            return;
        }
        if (error instanceof apiErrors_1.ApiError) {
            res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
            return;
        }
        logger_1.logger.error('Error updating intel visibility', error);
        res.status(500).json({
            error: {
                code: apiErrors_1.ApiErrorCode.INTERNAL_ERROR,
                message: 'Failed to update intel visibility',
            },
        });
    }
}
async function healthCheck(_req, res) {
    res.json({
        status: 'healthy',
        service: 'intel-v2',
        visibility_phases: ['1: PUBLIC/ORG/PRIVATE', '2: ALLIANCEONLY (deferred)'],
    });
}
exports.intelControllerV2 = {
    getIntelEntries,
    getIntelEntry,
    updateIntelVisibility,
    healthCheck,
};
//# sourceMappingURL=intelControllerV2.js.map