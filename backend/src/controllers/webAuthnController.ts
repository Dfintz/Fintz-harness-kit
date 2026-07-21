/**
 * WebAuthn Controller
 * Handles WebAuthn/FIDO2 credential registration, authentication, and step-up verification
 */

import { Request, Response } from 'express';

import {
  COOKIE_NAMES,
  getAccessTokenCookieOptions,
  refreshTokenCookieOptions,
} from '../config/cookies';
import { getBackendUrl } from '../config/urls';
import { AuthRequest } from '../middleware/auth';
import { createSessionBinding } from '../middleware/sessionBinding';
import { AuthenticationService } from '../services/authentication';
import { TwoFactorService } from '../services/authentication/TwoFactorService';
import { WebAuthnService } from '../services/authentication/WebAuthnService';
import { UserService } from '../services/user/UserService';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';

const MOBILE_AUTH_REDIRECT_URI = 'scfleetmanager://auth/callback';

export class WebAuthnController {
  private readonly webAuthnService: WebAuthnService;
  private readonly authService: AuthenticationService;
  private readonly userService: UserService;
  private readonly twoFactorService: TwoFactorService;

  constructor() {
    this.webAuthnService = new WebAuthnService();
    this.authService = new AuthenticationService();
    this.userService = new UserService();
    this.twoFactorService = new TwoFactorService();
  }

  /**
   * GET /api/auth/webauthn/credentials
   * Get all WebAuthn credentials for the authenticated user
   */
  async getCredentials(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const credentials = await this.webAuthnService.getUserCredentials(userId);

      res.status(200).json(credentials);
    } catch (error: unknown) {
      logger.error('Failed to get WebAuthn credentials', {
        userId: req.user?.id,
        error: getErrorMessage(error),
      });
      res.status(500).json({
        error: 'Failed to retrieve credentials',
        message: getErrorMessage(error),
      });
    }
  }

  /**
   * POST /api/auth/webauthn/register/start
   * Start credential registration - generates registration options
   */
  async startRegistration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const userName = req.user!.username;

      const options = await this.webAuthnService.generateRegistrationOptions(userId, userName);

      res.status(200).json(options);
    } catch (error: unknown) {
      logger.error('Failed to start WebAuthn registration', {
        userId: req.user?.id,
        error: getErrorMessage(error),
      });
      res.status(500).json({
        error: 'Failed to start registration',
        message: getErrorMessage(error),
      });
    }
  }

  /**
   * POST /api/auth/webauthn/register/complete
   * Complete credential registration - verifies and stores credential
   */
  async completeRegistration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { credential, deviceName } = req.body;

      if (!credential) {
        res.status(400).json({
          error: 'Missing credential',
          message: 'Credential response is required',
        });
        return;
      }

      // Get session metadata
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      const result = await this.webAuthnService.verifyRegistration(
        userId,
        credential,
        deviceName,
        metadata
      );

      res.status(201).json(result);
    } catch (error: unknown) {
      logger.error('Failed to complete WebAuthn registration', {
        userId: req.user?.id,
        error: getErrorMessage(error),
      });
      res.status(400).json({
        error: 'Registration failed',
        message: getErrorMessage(error),
      });
    }
  }

  /**
   * PATCH /api/auth/webauthn/credentials/:credentialId
   * Update credential device name
   */
  async updateCredential(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { credentialId } = req.params;
      const { deviceName } = req.body;

      if (!deviceName) {
        res.status(400).json({
          error: 'Missing device name',
          message: 'Device name is required',
        });
        return;
      }

      await this.webAuthnService.updateCredentialName(userId, credentialId, deviceName);

      res.status(200).json({
        message: 'Credential updated successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to update WebAuthn credential', {
        userId: req.user?.id,
        credentialId: req.params.credentialId,
        error: getErrorMessage(error),
      });
      res.status(400).json({
        error: 'Failed to update credential',
        message: getErrorMessage(error),
      });
    }
  }

  /**
   * DELETE /api/auth/webauthn/credentials/:credentialId
   * Remove a credential
   */
  async removeCredential(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { credentialId } = req.params;

      await this.webAuthnService.removeCredential(userId, credentialId);

      res.status(200).json({
        message: 'Credential removed successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to remove WebAuthn credential', {
        userId: req.user?.id,
        credentialId: req.params.credentialId,
        error: getErrorMessage(error),
      });
      res.status(400).json({
        error: 'Failed to remove credential',
        message: getErrorMessage(error),
      });
    }
  }

  /**
   * GET /api/auth/webauthn/supported
   * Check if WebAuthn is supported (utility endpoint)
   */
  async checkSupport(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const config = this.webAuthnService.getConfig();
      res.status(200).json({
        supported: true,
        config: {
          rpName: config.rpName,
          rpId: config.rpId,
          timeout: config.timeout,
        },
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to get WebAuthn configuration',
        message: getErrorMessage(error),
      });
    }
  }

  // ==================== PASSKEY AUTHENTICATION ====================

  /**
   * POST /api/v2/webauthn/authenticate/options
   * Generate authentication options for passkey login (public — no auth required)
   */
  async getAuthenticationOptions(req: Request, res: Response): Promise<void> {
    try {
      const options = await this.webAuthnService.generateAuthenticationOptions();

      res.status(200).json(options);
    } catch (error: unknown) {
      logger.error('Failed to generate WebAuthn authentication options', {
        error: getErrorMessage(error),
      });
      res.status(500).json({
        error: 'Failed to generate authentication options',
        message: getErrorMessage(error),
      });
    }
  }

  /**
   * POST /api/v2/webauthn/authenticate/verify
   * Verify passkey authentication and issue session tokens (public — no auth required)
   */
  async verifyAuthentication(req: Request, res: Response): Promise<void> {
    try {
      const { credential, challengeKey } = req.body;

      if (!credential || !challengeKey) {
        res.status(400).json({
          error: 'Missing credential or challengeKey',
          message: 'Both credential response and challengeKey are required',
        });
        return;
      }

      // Verify the WebAuthn assertion
      const result = await this.webAuthnService.verifyAuthentication(credential, challengeKey);

      if (!result.verified) {
        res.status(401).json({
          error: 'Authentication failed',
          message: 'Passkey verification failed',
        });
        return;
      }

      // Look up the user
      const user = await this.userService.getUserById(result.userId);
      if (!user) {
        res.status(401).json({
          error: 'Authentication failed',
          message: 'User not found',
        });
        return;
      }

      // Issue JWT tokens (same flow as OAuth login)
      const tokens = await this.authService.generateTokens(user, {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionBinding: createSessionBinding(req),
      });

      // Set httpOnly cookies
      // NOSONAR: CWE-1004/CWE-614 FP — options from config/cookies.ts set httpOnly: true, secure: true
      res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        getAccessTokenCookieOptions(tokens.accessToken)
      ); // NOSONAR
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions); // NOSONAR

      logger.info('Passkey authentication successful', {
        userId: user.id,
        credentialId: result.credentialId,
      });

      res.status(200).json({
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          role: user.role,
        },
        message: 'Passkey authentication successful',
      });
    } catch (error: unknown) {
      logger.error('Passkey authentication failed', {
        error: getErrorMessage(error),
      });
      res.status(401).json({
        error: 'Authentication failed',
        message: getErrorMessage(error),
      });
    }
  }

  // ==================== STEP-UP VERIFICATION ====================

  /**
   * POST /api/v2/webauthn/step-up/options
   * Generate step-up verification options for destructive actions (requires auth)
   * Uses the authenticated user's credentials for targeted verification
   */
  async getStepUpOptions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // Check if user has passkeys registered
      const hasPasskeys = await this.webAuthnService.hasCredentials(userId);

      // Check if user has 2FA enabled
      const user = await this.userService.getUserById(userId);
      const has2fa = user?.twoFactorEnabled ?? false;

      if (!hasPasskeys && !has2fa) {
        res.status(200).json({
          required: false,
          methods: [],
          message: 'No step-up verification configured',
        });
        return;
      }

      const methods: string[] = [];

      let passkeyOptions = null;
      if (hasPasskeys) {
        methods.push('passkey');
        passkeyOptions = await this.webAuthnService.generateAuthenticationOptions(userId);
      }

      if (has2fa) {
        methods.push('totp');
      }

      res.status(200).json({
        required: true,
        methods,
        passkeyOptions,
      });
    } catch (error: unknown) {
      logger.error('Failed to generate step-up options', {
        userId: req.user?.id,
        error: getErrorMessage(error),
      });
      res.status(500).json({
        error: 'Failed to generate step-up options',
        message: getErrorMessage(error),
      });
    }
  }

  /**
   * POST /api/v2/webauthn/step-up/verify
   * Verify step-up challenge (passkey or TOTP) for destructive actions
   */
  async verifyStepUp(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { method, credential, challengeKey, totpCode } = req.body;

      if (!method) {
        res.status(400).json({
          error: 'Missing verification method',
          message: 'Specify method: "passkey" or "totp"',
        });
        return;
      }

      if (method === 'passkey') {
        if (!credential || !challengeKey) {
          res.status(400).json({
            error: 'Missing passkey data',
            message: 'Both credential and challengeKey are required for passkey verification',
          });
          return;
        }

        const result = await this.webAuthnService.verifyAuthentication(credential, challengeKey);

        if (!result.verified || result.userId !== userId) {
          res.status(401).json({
            error: 'Verification failed',
            message: 'Passkey verification failed',
          });
          return;
        }

        logger.info('Step-up verification passed (passkey)', { userId });
        res.status(200).json({ verified: true, method: 'passkey' });
        return;
      }

      if (method === 'totp') {
        if (!totpCode) {
          res.status(400).json({
            error: 'Missing TOTP code',
            message: 'A 6-digit authenticator code is required',
          });
          return;
        }

        const user = await this.userService.getUserById(userId);
        if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
          res.status(400).json({
            error: '2FA not configured',
            message: 'Two-factor authentication is not enabled on this account',
          });
          return;
        }

        const normalizedCode = String(totpCode).trim().toUpperCase();
        const verified = this.twoFactorService.verifyToken(user.twoFactorSecret, normalizedCode);

        if (!verified) {
          res.status(401).json({
            error: 'Verification failed',
            message: 'Invalid authenticator code',
          });
          return;
        }

        logger.info('Step-up verification passed (totp)', { userId });
        res.status(200).json({ verified: true, method: 'totp' });
        return;
      }

      res.status(400).json({
        error: 'Invalid method',
        message: 'Supported methods: "passkey", "totp"',
      });
    } catch (error: unknown) {
      logger.error('Step-up verification failed', {
        userId: req.user?.id,
        error: getErrorMessage(error),
      });
      res.status(401).json({
        error: 'Verification failed',
        message: getErrorMessage(error),
      });
    }
  }

  // ==================== MOBILE PASSKEY LOGIN ====================

  /**
   * GET /api/v2/webauthn/mobile-authenticate
   * Serves a minimal HTML page that performs the WebAuthn ceremony in the browser
   * and redirects back to the mobile app with tokens via the custom URL scheme.
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Synchronous HTML response, no async needed
  async mobileAuthenticate(req: Request, res: Response): Promise<void> {
    const requestedRedirectUri = req.query.redirect_uri as string | undefined;

    // CWE-601/CWE-79: enforce a single fixed mobile redirect URI
    if (requestedRedirectUri && requestedRedirectUri !== MOBILE_AUTH_REDIRECT_URI) {
      res.status(400).json({ error: 'Invalid redirect_uri' });
      return;
    }

    const redirectUri = MOBILE_AUTH_REDIRECT_URI;

    // Use trusted backend URL configuration instead of request Host header
    const apiBaseUrl = getBackendUrl();

    // Serve a self-contained HTML page that handles the WebAuthn ceremony
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // deepcode ignore XSS: API base URL comes from trusted backend config. Redirect URI is
    // a fixed server-side constant and injected with JSON.stringify.
    // NOSONAR: CWE-79 false positive — no user-controlled HTML injection possible.
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Passkey Login — Fringe Core</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a1628; color: #b0c4de; font-family: -apple-system, system-ui, sans-serif;
           display: flex; align-items: center; justify-content: center; min-height: 100vh;
           padding: 24px; }
    .card { background: #0c1a2e; border: 1px solid rgba(0,217,255,0.2); border-radius: 12px;
            padding: 32px; max-width: 380px; width: 100%; text-align: center; }
    h1 { color: #00d9ff; font-size: 20px; margin-bottom: 8px; }
    p { font-size: 14px; color: #8a9eb5; margin-bottom: 24px; }
    .btn { background: #00d9ff; color: #0a1628; border: none; border-radius: 8px;
           padding: 14px 28px; font-size: 16px; font-weight: 600; cursor: pointer;
           width: 100%; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #ef4444; font-size: 14px; margin-top: 16px; display: none; }
    .spinner { display: none; margin: 16px auto; width: 32px; height: 32px;
               border: 3px solid rgba(0,217,255,0.2); border-top-color: #00d9ff;
               border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <h1>Fringe Core</h1>
    <p>Authenticate with your passkey to continue.</p>
    <button class="btn" id="startBtn" onclick="startAuth()">Sign in with Passkey</button>
    <div class="spinner" id="spinner"></div>
    <p class="error" id="error"></p>
  </div>
  <script>
    const API = ${JSON.stringify(apiBaseUrl)};
    const REDIRECT = ${JSON.stringify(redirectUri)};

    async function startAuth() {
      const btn = document.getElementById('startBtn');
      const spinner = document.getElementById('spinner');
      const errorEl = document.getElementById('error');
      btn.disabled = true;
      spinner.style.display = 'block';
      errorEl.style.display = 'none';

      try {
        // Step 1: Get authentication options
        const optRes = await fetch(API + '/api/v2/webauthn/authenticate/options', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
        });
        if (!optRes.ok) throw new Error('Failed to get authentication options');
        const options = await optRes.json();

        // Convert base64url challenge to ArrayBuffer
        options.challenge = base64urlToBuffer(options.challenge);
        if (options.allowCredentials) {
          options.allowCredentials = options.allowCredentials.map(function(c) {
            return Object.assign({}, c, { id: base64urlToBuffer(c.id) });
          });
        }

        // Step 2: Browser passkey prompt
        const assertion = await navigator.credentials.get({ publicKey: options });

        // Step 3: Encode assertion for server
        const credential = {
          id: assertion.id,
          rawId: bufferToBase64url(assertion.rawId),
          type: assertion.type,
          response: {
            authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
            clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
            signature: bufferToBase64url(assertion.response.signature),
            userHandle: assertion.response.userHandle
              ? bufferToBase64url(assertion.response.userHandle) : null,
          },
        };

        // Step 4: Verify with server
        const verifyRes = await fetch(API + '/api/v2/webauthn/authenticate/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: credential, challengeKey: options.challengeKey }),
        });

        if (!verifyRes.ok) throw new Error('Passkey verification failed');
        const result = await verifyRes.json();

        // Step 5: Redirect to mobile app with tokens
        var url = new URL(REDIRECT);
        url.searchParams.set('token', result.token || result.accessToken);
        url.searchParams.set('refreshToken', result.refreshToken);
        window.location.href = url.toString();
      } catch (err) {
        spinner.style.display = 'none';
        btn.disabled = false;
        errorEl.textContent = err.message || 'Authentication failed';
        errorEl.style.display = 'block';
      }
    }

    function base64urlToBuffer(b64) {
      var s = b64.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      var bin = atob(s);
      var buf = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return buf.buffer;
    }

    function bufferToBase64url(buf) {
      var bytes = new Uint8Array(buf);
      var s = '';
      for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    }
  </script>
</body>
</html>`);
  }
}
