"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrganizationId = getOrganizationId;
exports.getAuthenticatedUserId = getAuthenticatedUserId;
const errorHandlerV2_1 = require("../middleware/errorHandlerV2");
const api_1 = require("../types/api");
function getOrganizationId(req) {
    const orgId = req.params.orgId || req.user?.currentOrganizationId;
    if (!orgId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Organization context is required', 403);
    }
    return orgId;
}
function getAuthenticatedUserId(req) {
    return req.user?.id;
}
//# sourceMappingURL=tenantHelpers.js.map