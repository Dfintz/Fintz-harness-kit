"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAuthorizedFleet = loadAuthorizedFleet;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Fleet_1 = require("../../models/Fleet");
const PermissionManagerService_1 = require("../../services/security/permissions/PermissionManagerService");
const api_1 = require("../../types/api");
const tenantHelpers_1 = require("../../utils/tenantHelpers");
const fleetPermissionManager = new PermissionManagerService_1.PermissionManagerService();
async function loadAuthorizedFleet(req, fleetId, action) {
    const userId = (0, tenantHelpers_1.getAuthenticatedUserId)(req);
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }
    const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
    const fleet = await fleetRepo.findOne({ where: { id: fleetId } });
    if (!fleet) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FLEET_NOT_FOUND, 'Fleet not found', 404);
    }
    if (!fleet.organizationId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FLEET_NOT_FOUND, 'Fleet has no organization', 404);
    }
    const permission = await fleetPermissionManager.checkPermission(fleet.organizationId, userId, 'fleet', action);
    if (!permission.allowed) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FLEET_NOT_FOUND, 'Fleet not found', 404);
    }
    return fleet;
}
//# sourceMappingURL=fleetController.authorization.js.map