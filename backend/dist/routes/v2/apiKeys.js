"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const apiKeySchemas_1 = require("../../schemas/apiKeySchemas");
const UserApiKeyService_1 = require("../../services/security/UserApiKeyService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const router = (0, express_1.Router)();
exports.router = router;
const apiKeyService = new UserApiKeyService_1.UserApiKeyService();
router.use(auth_1.authenticate);
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const keys = await apiKeyService.listKeys(userId);
        res.success(keys);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to list API keys'), 500);
    }
});
router.post('/', (0, schemaValidation_1.validateSchema)(apiKeySchemas_1.apiKeySchemas.create), async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const { name, scopes, expiresInDays } = req.body;
        const result = await apiKeyService.createKey(userId, { name, scopes, expiresInDays }, req.ip);
        res.status(201).success(result);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create API key'), 500);
    }
});
router.get('/:keyId', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const key = await apiKeyService.getKey(userId, req.params.keyId);
        res.success(key);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get API key'), 500);
    }
});
router.put('/:keyId', (0, schemaValidation_1.validateSchema)(apiKeySchemas_1.apiKeySchemas.update), async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const { name, scopes } = req.body;
        const key = await apiKeyService.updateKey(userId, req.params.keyId, { name, scopes });
        res.success(key);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update API key'), 500);
    }
});
router.delete('/:keyId', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        await apiKeyService.revokeKey(userId, req.params.keyId);
        res.success({ revoked: true });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to revoke API key'), 500);
    }
});
//# sourceMappingURL=apiKeys.js.map