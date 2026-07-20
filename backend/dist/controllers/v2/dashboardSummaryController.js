"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardSummaryController = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const DashboardAggregatorService_1 = require("../../services/dashboard/DashboardAggregatorService");
const api_1 = require("../../types/api");
const logger_1 = require("../../utils/logger");
class DashboardSummaryController {
    aggregator = DashboardAggregatorService_1.DashboardAggregatorService.getInstance();
    async getSummary(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const membership = await this.resolveActiveMembership(userId);
        const orgId = membership?.organizationId;
        try {
            const summary = orgId
                ? await this.aggregator.getOrgSummary(userId, orgId, membership?.role ?? null)
                : await this.aggregator.getSoloSummary(userId);
            res.success(summary);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('DashboardSummaryController.getSummary failed', { userId, orgId, error });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to load dashboard summary', 500);
        }
    }
    async resolveActiveMembership(userId) {
        return database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).findOne({
            where: { userId, isActive: true },
            order: { joinedAt: 'DESC' },
        });
    }
}
exports.DashboardSummaryController = DashboardSummaryController;
//# sourceMappingURL=dashboardSummaryController.js.map