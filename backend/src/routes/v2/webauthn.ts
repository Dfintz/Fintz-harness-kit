/**
 * WebAuthn Routes (API v2)
 *
 * Web Authentication (WebAuthn/FIDO2) credential management endpoints supporting:
 * - WebAuthn support detection
 * - Credential management (registration, listing, updating, deletion)
 * - Multi-credential support for passwordless authentication
 *
 * Most routes require authentication except for support detection
 */

import { Request, Response, Router } from 'express';

import { WebAuthnController } from '../../controllers/webAuthnController';
import { authenticate } from '../../middleware/auth';
import { authenticationRateLimiter } from '../../middleware/rateLimiting';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let webAuthnController: WebAuthnController;
const getController = () => {
  if (!webAuthnController) {
    webAuthnController = new WebAuthnController();
  }
  return webAuthnController;
};

// ==================== SUPPORT DETECTION ====================

/**
 * GET /api/v2/webauthn/supported
 * Check if WebAuthn/FIDO2 is supported by the server
 * Public endpoint (no authentication required)
 * Returns: { supported: boolean, message?: string }
 */
router.get('/supported', (req: Request, res: Response) => getController().checkSupport(req, res));

// ==================== CREDENTIAL MANAGEMENT ====================

/**
 * GET /api/v2/webauthn/credentials
 * Get all WebAuthn credentials for the authenticated user
 * Returns: array of credentials with metadata (name, created date, last used)
 */
router.get('/credentials', authenticate, (req: Request, res: Response) =>
  getController().getCredentials(req, res)
);

/**
 * POST /api/v2/webauthn/register/start
 * Start WebAuthn credential registration process
 * Initiates the registration ceremony and returns registration options
 * Returns: { challenge, rp, user, pubKeyCredParams, timeout, attestation, extensions }
 */
router.post(
  '/register/start',
  authenticate,
  authenticationRateLimiter,
  (req: Request, res: Response) => getController().startRegistration(req, res)
);

/**
 * POST /api/v2/webauthn/register/complete
 * Complete WebAuthn credential registration
 * Verifies the attestation response and stores the credential
 * Request body: { attestationObject, clientDataJSON, credentialName? }
 * Returns: { credentialId, success: boolean, credential: {...} }
 */
router.post(
  '/register/complete',
  authenticate,
  authenticationRateLimiter,
  (req: Request, res: Response) => getController().completeRegistration(req, res)
);

/**
 * PATCH /api/v2/webauthn/credentials/:credentialId
 * Update WebAuthn credential metadata
 * Currently supports updating the credential name/display name
 * Request body: { name: string }
 * Returns: { credentialId, name, updated: Date }
 */
router.patch('/credentials/:credentialId', authenticate, (req: Request, res: Response) =>
  getController().updateCredential(req, res)
);

/**
 * DELETE /api/v2/webauthn/credentials/:credentialId
 * Remove a WebAuthn credential
 * Deletes the credential and prevents its future use for authentication
 * Returns: { success: boolean, credentialId }
 */
router.delete('/credentials/:credentialId', authenticate, (req: Request, res: Response) =>
  getController().removeCredential(req, res)
);

// ==================== PASSKEY AUTHENTICATION ====================

/**
 * POST /api/v2/webauthn/authenticate/options
 * Generate authentication options for passkey login
 * Public endpoint (no authentication required) — returns a challenge for the browser
 * Returns: { challenge, timeout, rpId, allowCredentials?, userVerification?, _challengeKey }
 */
router.post('/authenticate/options', authenticationRateLimiter, (req: Request, res: Response) =>
  getController().getAuthenticationOptions(req, res)
);

/**
 * POST /api/v2/webauthn/authenticate/verify
 * Verify passkey authentication assertion and issue session tokens
 * Public endpoint (no authentication required)
 * Request body: { credential: AuthenticatorAssertionResponse, challengeKey: string }
 * Returns: { token, accessToken, refreshToken, user }
 */
router.post('/authenticate/verify', authenticationRateLimiter, (req: Request, res: Response) =>
  getController().verifyAuthentication(req, res)
);

// ==================== STEP-UP VERIFICATION ====================

/**
 * POST /api/v2/webauthn/step-up/options
 * Get available step-up verification methods and passkey challenge
 * Requires authentication — checks which verification methods the user has configured
 * Returns: { required: boolean, methods: string[], passkeyOptions? }
 */
router.post('/step-up/options', authenticate, (req: Request, res: Response) =>
  getController().getStepUpOptions(req, res)
);

/**
 * POST /api/v2/webauthn/step-up/verify
 * Verify step-up challenge for destructive actions
 * Requires authentication — accepts passkey assertion or TOTP code
 * Request body: { method: 'passkey' | 'totp', credential?, challengeKey?, totpCode? }
 * Returns: { verified: boolean, method: string }
 */
router.post('/step-up/verify', authenticate, (req: Request, res: Response) =>
  getController().verifyStepUp(req, res)
);

// ==================== MOBILE PASSKEY LOGIN ====================

/**
 * GET /api/v2/webauthn/mobile-authenticate
 * Serves a self-contained HTML page for mobile passkey login.
 * The page performs the WebAuthn ceremony in the browser and redirects back
 * to the mobile app via the custom URL scheme with tokens.
 * Query: ?redirect_uri=scfleetmanager://auth/callback
 */
router.get('/mobile-authenticate', authenticationRateLimiter, (req: Request, res: Response) =>
  getController().mobileAuthenticate(req, res)
);

export { router };
