"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailabilityControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const availabilitySchemas_1 = require("../../schemas/availabilitySchemas");
const AvailabilityService_1 = require("../../services/calendar/AvailabilityService");
const api_1 = require("../../types/api");
class AvailabilityControllerV2 {
    service = new AvailabilityService_1.AvailabilityService();
    async setMyAvailability(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const { orgId } = req.params;
        const { error, value } = availabilitySchemas_1.setAvailability.validate(req.body);
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        const slots = await this.service.setAvailability(userId, orgId, value.slots);
        res.success({ slots, count: slots.length });
    }
    async getMyAvailability(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const { orgId } = req.params;
        const slots = await this.service.getMyAvailability(userId, orgId);
        res.success({ slots, count: slots.length });
    }
    async getGroupHeatmap(req, res) {
        const { orgId } = req.params;
        const teamId = req.query.teamId;
        const heatmap = await this.service.getGroupAvailability(orgId, teamId);
        res.success(heatmap);
    }
    async getBestTimes(req, res) {
        const { orgId } = req.params;
        const teamId = req.query.teamId;
        const { error, value } = availabilitySchemas_1.findBestTimes.validate({
            durationMinutes: parseInt(req.query.durationMinutes) || 60,
            minAttendees: parseInt(req.query.minAttendees) || 1,
        });
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        const windows = await this.service.findBestTimes(orgId, value.durationMinutes, value.minAttendees, 5, teamId);
        res.success({ windows, count: windows.length });
    }
    async getTeamAvailability(req, res) {
        const { orgId, teamId } = req.params;
        const heatmap = await this.service.getGroupAvailability(orgId, teamId);
        res.success(heatmap);
    }
    async getTeamBestTimes(req, res) {
        const { orgId, teamId } = req.params;
        const { error, value } = availabilitySchemas_1.findBestTimes.validate({
            durationMinutes: parseInt(req.query.durationMinutes) || 60,
            minAttendees: parseInt(req.query.minAttendees) || 1,
        });
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        const windows = await this.service.findBestTimes(orgId, value.durationMinutes, value.minAttendees, 5, teamId);
        res.success({ windows, count: windows.length });
    }
}
exports.AvailabilityControllerV2 = AvailabilityControllerV2;
//# sourceMappingURL=availabilityController.js.map