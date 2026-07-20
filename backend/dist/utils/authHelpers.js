"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticatedUserId = getAuthenticatedUserId;
exports.getActiveOrganizationId = getActiveOrganizationId;
exports.getOrganizationIdFromContext = getOrganizationIdFromContext;
exports.isAuthenticated = isAuthenticated;
const errorHandlerV2_1 = require("../middleware/errorHandlerV2");
const api_1 = require("../types/api");
function getAuthenticatedUserId(req) {
    const userId = req.user?.id;
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
    }
    return userId;
}
function getActiveOrganizationId(req) {
    return req.user?.activeOrgId;
}
function getOrganizationIdFromContext(req) {
    const organizationId = req.tenantContext?.organizationId;
    if (!organizationId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_MEMBERSHIP_REQUIRED, 'Organization context required', 400);
    }
    return organizationId;
}
function isAuthenticated(req) {
    return !!req.user?.id;
}
//# sourceMappingURL=authHelpers.js.map