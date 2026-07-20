"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveErrorStatus = resolveErrorStatus;
exports.mapStatusToApiErrorCode = mapStatusToApiErrorCode;
exports.normalizeApiError = normalizeApiError;
exports.sendFleetErrorResponse = sendFleetErrorResponse;
exports.sendFleetInternalErrorResponse = sendFleetInternalErrorResponse;
exports.sendFleetLoggedErrorResponse = sendFleetLoggedErrorResponse;
exports.rethrowApiOrSendFleetInternalErrorResponse = rethrowApiOrSendFleetInternalErrorResponse;
exports.sendFleetDefaultErrorResponse = sendFleetDefaultErrorResponse;
exports.throwIfFleetAggregatorFailed = throwIfFleetAggregatorFailed;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
function resolveErrorStatus(error) {
    if (error instanceof errorHandlerV2_1.ApiError) {
        return error.statusCode;
    }
    if (error !== null &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof error.statusCode === 'number') {
        return error.statusCode;
    }
    return 500;
}
function mapStatusToApiErrorCode(statusCode) {
    switch (statusCode) {
        case 400:
            return api_1.ApiErrorCode.INVALID_INPUT;
        case 401:
            return api_1.ApiErrorCode.UNAUTHORIZED;
        case 403:
            return api_1.ApiErrorCode.FORBIDDEN;
        case 404:
            return api_1.ApiErrorCode.RESOURCE_NOT_FOUND;
        case 409:
            return api_1.ApiErrorCode.RESOURCE_CONFLICT;
        default:
            return api_1.ApiErrorCode.INTERNAL_ERROR;
    }
}
function normalizeApiError(error, fallbackMessage) {
    if (error instanceof errorHandlerV2_1.ApiError) {
        return error;
    }
    const statusCode = resolveErrorStatus(error);
    const message = (0, errorHandler_1.getErrorMessage)(error, fallbackMessage);
    const codeValue = error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string'
        ? error.code
        : undefined;
    const resolvedCode = codeValue && Object.values(api_1.ApiErrorCode).includes(codeValue)
        ? codeValue
        : mapStatusToApiErrorCode(statusCode);
    return new errorHandlerV2_1.ApiError(resolvedCode, message, statusCode);
}
function sendFleetErrorResponse(res, error, options) {
    const statusCode = options?.forceStatusCode ?? resolveErrorStatus(error);
    const message = (0, errorHandler_1.getErrorMessage)(error, options?.fallbackMessage);
    if (options?.logMessage && statusCode >= (options?.logAtOrAboveStatus ?? 500)) {
        const logPayload = options.logContext
            ? {
                error: message,
                path: options.path,
                ...options.logContext,
            }
            : {
                error: message,
                path: options.path,
            };
        logger_1.logger.error(options.logMessage, logPayload);
    }
    res.status(statusCode).json({ success: false, error: { code: 'FLEET_ERROR', message } });
}
function sendFleetInternalErrorResponse(res, error, logMessage, path) {
    sendFleetErrorResponse(res, error, {
        forceStatusCode: 500,
        logAtOrAboveStatus: 0,
        logMessage,
        path,
    });
}
function sendFleetLoggedErrorResponse(res, error, logMessage, path) {
    sendFleetErrorResponse(res, error, {
        logMessage,
        path,
    });
}
function rethrowApiOrSendFleetInternalErrorResponse(res, error, logMessage, path) {
    if (error instanceof errorHandlerV2_1.ApiError) {
        throw error;
    }
    sendFleetInternalErrorResponse(res, error, logMessage, path);
}
function sendFleetDefaultErrorResponse(res, error) {
    sendFleetErrorResponse(res, error);
}
function throwIfFleetAggregatorFailed(result, fallbackMessage) {
    if (!result.success) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(result.error, fallbackMessage), 500);
    }
}
//# sourceMappingURL=fleetController.errors.js.map