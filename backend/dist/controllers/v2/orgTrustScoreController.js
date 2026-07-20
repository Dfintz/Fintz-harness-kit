"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgTrustScoreController = void 0;
const OrgTrustScoreService_1 = require("../../services/organization/OrgTrustScoreService");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const BaseController_1 = require("../BaseController");
let trustScoreService;
const getService = () => {
    if (!trustScoreService) {
        trustScoreService = new OrgTrustScoreService_1.OrgTrustScoreService();
    }
    return trustScoreService;
};
class OrgTrustScoreController extends BaseController_1.BaseController {
    async getTrustScore(req, res) {
        await this.executeAndReturn(req, res, async (actionReq) => {
            const organizationId = actionReq.params.id;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID is required');
            }
            try {
                return await getService().getTrustScore(organizationId);
            }
            catch (error) {
                if (error instanceof apiErrors_1.ApiError) {
                    throw error;
                }
                logger_1.logger.error('Failed to get org trust score', {
                    error: error instanceof Error ? error.message : String(error),
                    organizationId,
                });
                throw new apiErrors_1.DatabaseError('Failed to compute trust score');
            }
        });
    }
}
exports.OrgTrustScoreController = OrgTrustScoreController;
//# sourceMappingURL=orgTrustScoreController.js.map