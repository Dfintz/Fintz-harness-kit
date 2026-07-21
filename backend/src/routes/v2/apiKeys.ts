import { Response, Router } from 'express';

import { type AuthRequest, authenticate } from '../../middleware/auth';
import { ApiError } from '../../middleware/errorHandlerV2';
import { validateSchema } from '../../middleware/schemaValidation';
import { apiKeySchemas } from '../../schemas/apiKeySchemas';
import { UserApiKeyService } from '../../services/security/UserApiKeyService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

const router = Router();
const apiKeyService = new UserApiKeyService();

// All API key routes require authentication (JWT only — not API key auth)
router.use(authenticate);

// ==================== API KEYS ====================

/**
 * GET /api/v2/api-keys
 * List user's API keys
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const keys = await apiKeyService.listKeys(userId);
    res.success(keys);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to list API keys'),
      500
    );
  }
});

/**
 * POST /api/v2/api-keys
 * Create new API key
 */
router.post('/', validateSchema(apiKeySchemas.create), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { name, scopes, expiresInDays } = req.body as {
      name: string;
      scopes: string[];
      expiresInDays?: number;
    };

    const result = await apiKeyService.createKey(userId, { name, scopes, expiresInDays }, req.ip);

    res.status(201).success(result);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to create API key'),
      500
    );
  }
});

/**
 * GET /api/v2/api-keys/:keyId
 * Get API key details
 */
router.get('/:keyId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const key = await apiKeyService.getKey(userId, req.params.keyId);
    res.success(key);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to get API key'),
      500
    );
  }
});

/**
 * PUT /api/v2/api-keys/:keyId
 * Update API key
 */
router.put(
  '/:keyId',
  validateSchema(apiKeySchemas.update),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const { name, scopes } = req.body as { name?: string; scopes?: string[] };
      const key = await apiKeyService.updateKey(userId, req.params.keyId, { name, scopes });
      res.success(key);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to update API key'),
        500
      );
    }
  }
);

/**
 * DELETE /api/v2/api-keys/:keyId
 * Revoke API key
 */
router.delete('/:keyId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    await apiKeyService.revokeKey(userId, req.params.keyId);
    res.success({ revoked: true });
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      getErrorMessage(error, 'Failed to revoke API key'),
      500
    );
  }
});

export { router };
