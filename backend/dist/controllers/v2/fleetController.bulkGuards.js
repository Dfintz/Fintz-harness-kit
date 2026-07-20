"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthenticatedUser = requireAuthenticatedUser;
exports.validateBulkUpdateRequest = validateBulkUpdateRequest;
exports.validateBulkDeleteRequest = validateBulkDeleteRequest;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const api_1 = require("../../types/api");
const BULK_OPERATION_LIMIT = 100;
function requireAuthenticatedUser(userId) {
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }
    return userId;
}
function validateBulkUpdateRequest(updates) {
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Updates array is required', 400);
    }
    if (updates.length > BULK_OPERATION_LIMIT) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Maximum 100 members can be updated at once', 400);
    }
}
function validateBulkDeleteRequest(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'items array is required (each entry must include fleetId and shipId)', 400);
    }
    if (items.length > BULK_OPERATION_LIMIT) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Maximum 100 members can be deleted at once', 400);
    }
}
//# sourceMappingURL=fleetController.bulkGuards.js.map