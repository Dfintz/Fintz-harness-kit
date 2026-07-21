/**
 * WebAuthn Routes
 * Routes for WebAuthn/FIDO2 credential management
 */

import { Router, Application } from 'express';

import { WebAuthnController } from '../controllers/webAuthnController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let webAuthnController: WebAuthnController;
const getController = () => {
  if (!webAuthnController) {
    webAuthnController = new WebAuthnController();
  }
  return webAuthnController;
};

export const setWebAuthnRoutes = (app: Application) => {
  // Check WebAuthn support
  router.get(
    '/auth/webauthn/supported',
    (req, res) => getController().checkSupport(req, res)
  );

  // Get user's credentials
  router.get(
    '/auth/webauthn/credentials',
    authenticateToken,
    (req, res) => getController().getCredentials(req, res)
  );

  // Start credential registration
  router.post(
    '/auth/webauthn/register/start',
    authenticateToken,
    (req, res) => getController().startRegistration(req, res)
  );

  // Complete credential registration
  router.post(
    '/auth/webauthn/register/complete',
    authenticateToken,
    (req, res) => getController().completeRegistration(req, res)
  );

  // Update credential name
  router.patch(
    '/auth/webauthn/credentials/:credentialId',
    authenticateToken,
    (req, res) => getController().updateCredential(req, res)
  );

  // Remove credential
  router.delete(
    '/auth/webauthn/credentials/:credentialId',
    authenticateToken,
    (req, res) => getController().removeCredential(req, res)
  );

  app.use('/api', router);
};
