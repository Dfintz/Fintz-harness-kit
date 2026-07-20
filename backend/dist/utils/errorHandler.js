"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isError = isError;
exports.isAxiosError = isAxiosError;
exports.hasMessage = hasMessage;
exports.hasResponse = hasResponse;
exports.getErrorMessage = getErrorMessage;
exports.logError = logError;
exports.formatUserError = formatUserError;
exports.withErrorHandling = withErrorHandling;
exports.safeAsync = safeAsync;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
function isError(error) {
    return error instanceof Error;
}
function isAxiosError(error) {
    return axios_1.default.isAxiosError(error);
}
function hasMessage(error) {
    if (typeof error !== 'object' || error === null || !('message' in error)) {
        return false;
    }
    return typeof error.message === 'string';
}
function hasResponse(error) {
    if (typeof error !== 'object' || error === null || !('response' in error)) {
        return false;
    }
    return typeof error.response === 'object' && error.response !== null;
}
function extractResponseDataMessage(data) {
    if (!data || typeof data !== 'object') {
        return undefined;
    }
    const record = data;
    if (typeof record.message === 'string') {
        return record.message;
    }
    if (typeof record.error === 'string') {
        return record.error;
    }
    if (record.error &&
        typeof record.error === 'object' &&
        typeof record.error.message === 'string') {
        return record.error.message;
    }
    return undefined;
}
function getErrorMessage(error, fallback = 'An unknown error occurred') {
    if (isAxiosError(error)) {
        const responseMessage = extractResponseDataMessage(error.response?.data);
        return responseMessage || error.message || fallback;
    }
    if (hasResponse(error)) {
        const responseMessage = extractResponseDataMessage(error.response?.data);
        return responseMessage || fallback;
    }
    if (isError(error)) {
        return error.message || fallback;
    }
    if (hasMessage(error)) {
        return error.message || fallback;
    }
    if (typeof error === 'string') {
        return error || fallback;
    }
    return fallback;
}
function logError(error, context) {
    const message = getErrorMessage(error);
    if (isError(error)) {
        logger_1.logger.error(`${context}: ${message}`, {
            error: error.message,
            stack: error.stack,
            name: error.name,
        });
    }
    else if (isAxiosError(error)) {
        logger_1.logger.error(`${context}: ${message}`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
            method: error.config?.method,
        });
    }
    else {
        logger_1.logger.error(`${context}: ${message}`, { error });
    }
}
function formatUserError(error, includeDetails = false) {
    const message = getErrorMessage(error);
    if (!includeDetails) {
        return message;
    }
    if (isAxiosError(error) && error.response) {
        return `${message} (Status: ${error.response.status})`;
    }
    if (isError(error) && error.name !== 'Error') {
        return `${error.name}: ${message}`;
    }
    return message;
}
async function withErrorHandling(operation, context) {
    try {
        return await operation();
    }
    catch (error) {
        logError(error, context);
        throw error;
    }
}
async function safeAsync(operation) {
    try {
        const result = await operation();
        return [null, result];
    }
    catch (error) {
        if (isError(error)) {
            return [error, null];
        }
        return [new Error(getErrorMessage(error)), null];
    }
}
//# sourceMappingURL=errorHandler.js.map