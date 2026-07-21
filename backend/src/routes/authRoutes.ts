import { Application, Router } from 'express';

import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { corsConfig } from '../middleware/security';
import { authSchemas } from '../schemas';

// Lazy initialization to avoid EntityMetadataNotFoundError
let authController: AuthController;
const getController = () => {
  if (!authController) {
    authController = new AuthController();
  }
  return authController;
};

// Flag to prevent duplicate route registration
let routesRegistered = false;

export const setAuthRoutes = (app: Application) => {
  // Prevent duplicate registration
  if (routesRegistered) {
    return;
  }
  routesRegistered = true;

  // Create router inside function to avoid module-level side effects
  const router = Router();

  // Login - generates access token and refresh token
  router.post('/auth/login', validateSchema(authSchemas.login, 'body'), (req, res) =>
    getController().login(req, res)
  );

  // Development/demo login - non-production convenience
  router.post('/auth/demo', validateSchema(authSchemas.demoLogin, 'body'), (req, res) =>
    getController().devLogin(req, res)
  );

  // Discord OAuth callback - exchanges code for tokens
  // Explicit OPTIONS handler for CORS preflight
  // This ensures proper CORS headers are sent for authentication requests
  router.options('/auth/discord/callback', corsConfig);

  // Legacy v1 callback: now deprecated. Respond with guidance to use v2 endpoint.
  router.get('/auth/discord/callback', (req, res) => {
    res.status(410).json({
      error: 'Discord callback moved to /api/v2/auth/discord/callback',
      action: 'Update Discord Developer Portal redirect URI and frontend to use v2 endpoint.',
    });
  });
  router.post('/auth/discord/callback', (req, res) => {
    res.status(410).json({
      error: 'Discord callback moved to /api/v2/auth/discord/callback',
      action: 'Update Discord Developer Portal redirect URI and frontend to use v2 endpoint.',
    });
  });

  // Azure AD OAuth callback
  // Explicit OPTIONS handler for CORS preflight
  router.options('/auth/azuread/callback', corsConfig);

  // Legacy v1 callback: now deprecated. Respond with guidance to use v2 endpoint.
  router.get('/auth/azuread/callback', (req, res) => {
    res.status(410).json({
      error: 'Azure AD callback moved to /api/v2/auth/azuread/callback',
      action: 'Update Entra ID redirect URI and frontend to use v2 endpoint.',
    });
  });
  router.post('/auth/azuread/callback', (req, res) => {
    res.status(410).json({
      error: 'Azure AD callback moved to /api/v2/auth/azuread/callback',
      action: 'Update Entra ID redirect URI and frontend to use v2 endpoint.',
    });
  });

  // Refresh token - exchanges refresh token for new access token
  router.post('/auth/refresh', validateSchema(authSchemas.refresh, 'body'), (req, res) =>
    getController().refresh(req, res)
  );

  // Logout - revokes a single refresh token
  router.post(
    '/auth/logout',
    authenticateToken,
    validateSchema(authSchemas.logout, 'body'),
    (req, res) => getController().logout(req, res)
  );

  // Logout all - revokes all refresh tokens for the user
  router.post('/auth/logout-all', authenticateToken, (req, res) =>
    getController().logoutAll(req, res)
  );

  // Get active sessions - returns all active refresh tokens
  router.get('/auth/sessions', authenticateToken, (req, res) =>
    getController().getActiveSessions(req, res)
  );

  app.use('/api', router);
};
