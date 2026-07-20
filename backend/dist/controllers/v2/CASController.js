"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASController = void 0;
const CASQueryService_1 = require("../../services/analytics/CASQueryService");
const api_1 = require("../../types/api");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class CASController extends BaseController_1.BaseController {
    queryService = new CASQueryService_1.CASQueryService();
    parseBooleanQuery(value, defaultValue) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            return value.toLowerCase() !== 'false';
        }
        return defaultValue;
    }
    async getScore(req, res) {
        await this.executeAndReturn(req, res, async (actionReq) => {
            const { orgId } = actionReq.params;
            const result = await this.queryService.getCurrentScore(orgId);
            if (!result) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'No CAS score available for this organization yet', 404);
            }
            return result;
        });
    }
    async getHistory(req, res) {
        await this.executeAndReturn(req, res, async (actionReq) => {
            const { orgId } = actionReq.params;
            const days = Number(actionReq.query.days ?? 30);
            const history = await this.queryService.getScoreHistory(orgId, days);
            return { data: history, days };
        });
    }
    async getBreakdown(req, res) {
        await this.executeAndReturn(req, res, async (actionReq) => {
            const { orgId } = actionReq.params;
            const breakdown = await this.queryService.getScoreBreakdown(orgId);
            if (!breakdown) {
                throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'No CAS data available for this organization yet', 404);
            }
            return breakdown;
        });
    }
    async getHeatmap(req, res) {
        await this.executeAndReturn(req, res, async (actionReq) => {
            const { orgId } = actionReq.params;
            const days = Number(actionReq.query.days ?? 7);
            const logScale = this.parseBooleanQuery(actionReq.query.logScale, true);
            return this.queryService.getHeatmap(orgId, days, logScale);
        });
    }
    async getRanking(req, res) {
        await this.executeAndReturn(req, res, async (actionReq) => {
            const limit = Number(actionReq.query.limit ?? 20);
            const ranking = await this.queryService.getOrgRanking(limit);
            return { data: ranking };
        });
    }
}
exports.CASController = CASController;
//# sourceMappingURL=CASController.js.map