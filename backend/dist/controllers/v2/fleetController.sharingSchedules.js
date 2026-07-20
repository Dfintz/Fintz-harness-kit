"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFleetSharingHandler = getFleetSharingHandler;
exports.updateFleetSharingHandler = updateFleetSharingHandler;
exports.getFleetScheduleHandler = getFleetScheduleHandler;
exports.createFleetScheduleHandler = createFleetScheduleHandler;
exports.updateFleetScheduleHandler = updateFleetScheduleHandler;
exports.deleteFleetScheduleHandler = deleteFleetScheduleHandler;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const Fleet_1 = require("../../models/Fleet");
const api_1 = require("../../types/api");
const tenantHelpers_1 = require("../../utils/tenantHelpers");
const fleetController_errors_1 = require("./fleetController.errors");
const fleetController_lookup_1 = require("./fleetController.lookup");
async function getFleetSharingHandler(req, res) {
    try {
        const { id: fleetId } = req.params;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const fleet = await (0, fleetController_lookup_1.loadFleetInOrganization)(fleetId, organizationId, {
            notFoundCode: api_1.ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        const sharing = {
            visibility: fleet.visibility ?? 'private',
            allowedOrganizations: fleet.allowedOrganizations ?? [],
            publicViewEnabled: fleet.publicViewEnabled ?? false,
            allowJoinRequests: fleet.allowJoinRequests ?? false,
        };
        res.success(sharing);
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to get fleet sharing settings');
    }
}
async function updateFleetSharingHandler(req, res) {
    try {
        const { id: fleetId } = req.params;
        const settings = req.body;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const fleet = await (0, fleetController_lookup_1.loadFleetInOrganization)(fleetId, organizationId, {
            notFoundCode: api_1.ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        const updatedSharing = {
            visibility: settings.visibility ?? fleet.visibility ?? 'private',
            allowedOrganizations: Array.isArray(settings.allowedOrganizations)
                ? settings.allowedOrganizations
                : (fleet.allowedOrganizations ?? []),
            publicViewEnabled: typeof settings.publicViewEnabled === 'boolean'
                ? settings.publicViewEnabled
                : (fleet.publicViewEnabled ?? false),
            allowJoinRequests: typeof settings.allowJoinRequests === 'boolean'
                ? settings.allowJoinRequests
                : (fleet.allowJoinRequests ?? false),
        };
        fleet.visibility = updatedSharing.visibility;
        fleet.allowedOrganizations = updatedSharing.allowedOrganizations;
        fleet.publicViewEnabled = updatedSharing.publicViewEnabled;
        fleet.allowJoinRequests = updatedSharing.allowJoinRequests;
        await fleetRepo.save(fleet);
        res.success(updatedSharing);
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to update fleet sharing settings');
    }
}
async function getFleetScheduleHandler(req, res) {
    try {
        const { id: fleetId } = req.params;
        const queryParams = req.queryParams ?? {};
        const { startDate: _startDate, endDate: _endDate, limit = 50, offset = 0 } = queryParams;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        await (0, fleetController_lookup_1.loadFleetInOrganization)(fleetId, organizationId, {
            notFoundCode: api_1.ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        const schedules = [
            {
                id: 'schedule1',
                fleetId,
                operation: 'Patrol',
                scheduledAt: new Date(),
                status: 'upcoming',
            },
            {
                id: 'schedule2',
                fleetId,
                operation: 'Training',
                scheduledAt: new Date(),
                status: 'upcoming',
            },
        ];
        const total = schedules.length;
        const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/fleets/${fleetId}/schedule`, Number(offset), Number(limit), total);
        res.paginated(schedules.slice(Number(offset), Number(offset) + Number(limit)), {
            total,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + Number(limit) < total,
        }, links);
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to get fleet schedule');
    }
}
async function createFleetScheduleHandler(req, res) {
    try {
        const { id: fleetId } = req.params;
        const { operation, scheduledAt, description, participants } = req.body;
        if (!operation || !scheduledAt) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Operation name and scheduled time are required', 400);
        }
        await (0, fleetController_lookup_1.loadFleetInOrganization)(fleetId, (0, tenantHelpers_1.getOrganizationId)(req), {
            notFoundCode: api_1.ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        const schedule = {
            id: `schedule_${Date.now()}`,
            fleetId,
            operation,
            scheduledAt,
            description,
            participants: participants ?? [],
            status: 'upcoming',
            createdAt: new Date(),
        };
        res.status(201).success(schedule);
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to create fleet schedule');
    }
}
async function updateFleetScheduleHandler(req, res) {
    try {
        const { id: fleetId, scheduleId } = req.params;
        const updates = req.body;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        await (0, fleetController_lookup_1.loadFleetInOrganization)(fleetId, organizationId, {
            notFoundCode: api_1.ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        const schedule = {
            id: scheduleId,
            fleetId,
            ...updates,
            updatedAt: new Date(),
        };
        res.success(schedule);
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to update fleet schedule');
    }
}
async function deleteFleetScheduleHandler(req, res) {
    try {
        const { id: fleetId, scheduleId: _scheduleId } = req.params;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        await (0, fleetController_lookup_1.loadFleetInOrganization)(fleetId, organizationId, {
            notFoundCode: api_1.ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        res.status(204).success({ message: 'Fleet operation cancelled successfully' });
    }
    catch (error) {
        throw (0, fleetController_errors_1.normalizeApiError)(error, 'Failed to delete fleet schedule');
    }
}
//# sourceMappingURL=fleetController.sharingSchedules.js.map