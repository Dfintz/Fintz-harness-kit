"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagController = void 0;
const FeatureFlagService_1 = require("../services/admin/FeatureFlagService");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
class FeatureFlagController extends BaseController_1.BaseController {
    evaluateFlag = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { flagId } = req.params;
            const userId = req.user?.id;
            const organizationId = req.user?.activeOrgId;
            const isEnabled = await FeatureFlagService_1.FeatureFlagService.isEnabled(flagId, userId, organizationId);
            return {
                flagId,
                enabled: isEnabled,
                timestamp: new Date().toISOString(),
            };
        });
    };
    evaluateBatch = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { flagIds } = req.body;
            if (!Array.isArray(flagIds)) {
                throw new apiErrors_1.ValidationError('flagIds must be an array');
            }
            const userId = req.user?.id;
            const organizationId = req.user?.activeOrgId;
            const evaluationPromises = flagIds.map(async (flagId) => {
                const enabled = await FeatureFlagService_1.FeatureFlagService.isEnabled(flagId, userId, organizationId);
                return { flagId, enabled };
            });
            const evaluations = await Promise.all(evaluationPromises);
            const results = {};
            evaluations.forEach(({ flagId, enabled }) => {
                results[flagId] = enabled;
            });
            return {
                flags: results,
                timestamp: new Date().toISOString(),
            };
        });
    };
    getEnabledFlags = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = req.user?.id;
            const organizationId = req.user?.activeOrgId;
            const enabledFlags = await FeatureFlagService_1.FeatureFlagService.getEnabledFeatures(userId, organizationId);
            return {
                flags: enabledFlags,
                timestamp: new Date().toISOString(),
            };
        });
    };
    getAnalytics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const days = parseInt(req.query.days) || 30;
            const analytics = await FeatureFlagService_1.FeatureFlagService.getAnalytics(id, days);
            return analytics;
        });
    };
}
exports.FeatureFlagController = FeatureFlagController;
//# sourceMappingURL=FeatureFlagController.js.map