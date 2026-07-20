/**
 * WebAuthn/Passkey Service
 *
 * API client for managing WebAuthn credentials (passkeys, security keys).
 * Provides methods for registration and authentication flows.
 */

import { logger } from '@/utils/logger';
import { apiClient, isApiClientError } from './apiClient';

/**
 * Unwrap a server response envelope.
 *
 * Canonical shape is `{ data: T }`. A flat `T` shape is tolerated for backward
 * compatibility with older WebAuthn endpoints; when the fallback fires we emit a
 * debug log so we can track and remove the legacy shape later.
 *
 * Throws if the response is not an object or the payload is null/undefined,
 * preventing downstream `undefined` reads that previously hid behind permissive casts.
 */
function unwrapEnvelope<T>(response: unknown, context: string): T {
  if (response === null || response === undefined || typeof response !== 'object') {
    throw new Error(`Invalid response envelope from server (${context})`);
  }
  const body = response as Record<string, unknown>;
  if ('data' in body && body.data !== null && body.data !== undefined) {
    return body.data as T;
  }
  logger.debug(`WebAuthn endpoint returned flat shape (no 'data' envelope): ${context}`);
  return body as T;
}

export interface WebAuthnCredential {
  id: string;
  deviceName?: string;
  createdAt: string;
  lastUsedAt?: string;
  useCount: number;
  backedUp: boolean;
  transports?: string[];
}

export interface RegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: string;
    alg: number;
  }>;
  timeout: number;
  excludeCredentials?: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    requireResidentKey?: boolean;
    residentKey?: 'discouraged' | 'preferred' | 'required';
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise';
}

export interface AuthenticationOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials?: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

/**
 * WebAuthn/Passkey Service
 * Handles passkey registration, authentication, and credential management
 */
export class WebAuthnService {
  /**
   * Check if WebAuthn is supported in the current browser
   */
  isSupported(): boolean {
    return (
      window.PublicKeyCredential !== undefined && typeof window.PublicKeyCredential === 'function'
    );
  }

  /**
   * Get all WebAuthn credentials for the authenticated user
   */
  async getCredentials(): Promise<WebAuthnCredential[]> {
    const response = await apiClient.get('/api/v2/webauthn/credentials');
    return unwrapEnvelope<WebAuthnCredential[]>(response, 'getCredentials') ?? [];
  }

  /**
   * Start credential registration flow
   * Step 1: Get registration options from server
   */
  async startRegistration(): Promise<RegistrationOptions> {
    const response = await apiClient.post('/api/v2/webauthn/register/start');
    const options = unwrapEnvelope<RegistrationOptions>(response, 'startRegistration');

    // Validate the server returned valid registration options
    if (!options?.challenge || !options?.rp || !options?.user?.id) {
      logger.error('Invalid WebAuthn registration options received from server', { options });
      throw new Error(
        'Server returned invalid registration options. Please try again or contact support.'
      );
    }

    return options;
  }

  /**
   * Complete credential registration
   * Step 2: Register credential with authenticator and send response to server
   */
  async completeRegistration(
    options: RegistrationOptions,
    deviceName?: string
  ): Promise<WebAuthnCredential> {
    try {
      // Convert base64url strings to ArrayBuffer
      const publicKey = this.preparePublicKeyOptions(options);

      // Create credential using WebAuthn API
      const credential = (await navigator.credentials.create({
        publicKey,
      })) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Prepare credential response for server
      const credentialResponse = this.prepareCredentialResponse(credential);

      // Send to server for verification and storage
      const response = await apiClient.post('/api/v2/webauthn/register/complete', {
        credential: credentialResponse,
        deviceName,
      });

      return unwrapEnvelope<WebAuthnCredential>(response, 'completeRegistration');
    } catch (error: unknown) {
      logger.error('WebAuthn registration failed:', error);
      throw new Error(this.getErrorMessage(error));
    }
  }

  /**
   * Update credential device name
   */
  async updateCredentialName(credentialId: string, deviceName: string): Promise<void> {
    await apiClient.patch(`/api/v2/webauthn/credentials/${credentialId}`, {
      deviceName,
    });
  }

  /**
   * Remove a credential
   */
  async removeCredential(credentialId: string): Promise<void> {
    await apiClient.delete(`/api/v2/webauthn/credentials/${credentialId}`);
  }

  /**
   * Prepare public key options for WebAuthn API
   * Converts base64url strings to ArrayBuffer
   */
  private preparePublicKeyOptions(
    options: RegistrationOptions
  ): PublicKeyCredentialCreationOptions {
    return {
      challenge: this.base64urlToBuffer(options.challenge),
      rp: options.rp,
      user: {
        id: this.base64urlToBuffer(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams as PublicKeyCredentialParameters[],
      timeout: options.timeout,
      excludeCredentials: options.excludeCredentials?.map(cred => ({
        id: this.base64urlToBuffer(cred.id),
        type: cred.type as PublicKeyCredentialType,
        transports: cred.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: options.authenticatorSelection,
      attestation: options.attestation,
    };
  }

  /**
   * Prepare credential response for server
   * Converts ArrayBuffer to base64url strings
   */
  private prepareCredentialResponse(credential: PublicKeyCredential): unknown {
    const response = credential.response as AuthenticatorAttestationResponse;

    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: this.bufferToBase64url(response.attestationObject),
        clientDataJSON: this.bufferToBase64url(response.clientDataJSON),
        transports: response.getTransports ? response.getTransports() : [],
      },
    };
  }

  /**
   * Convert base64url string to ArrayBuffer
   */
  private base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return bytes.buffer;
  }

  /**
   * Convert ArrayBuffer to base64url string
   */
  private bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Get user-friendly error message
   * Public method for external use
   */
  getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        return 'Authentication cancelled or not allowed';
      }
      if (error.name === 'InvalidStateError') {
        return 'This authenticator is already registered';
      }
      if (error.name === 'NotSupportedError') {
        return 'WebAuthn is not supported on this device';
      }
      return error.message;
    }
    return 'An unknown error occurred';
  }

  // ==================== PASSKEY AUTHENTICATION ====================

  /**
   * Get authentication options from the server (public — no auth required)
   * Uses apiClient.postRaw — the interceptor only adds Authorization when a real token
   * is present (and !== 'cookie-auth'), so stale headers on the login page are not an issue.
   */
  async getAuthenticationOptions(): Promise<AuthenticationOptions & { _challengeKey?: string }> {
    const body = await apiClient.postRaw<Record<string, unknown>>(
      '/api/v2/webauthn/authenticate/options'
    );
    return unwrapEnvelope<AuthenticationOptions & { _challengeKey?: string }>(
      body,
      'getAuthenticationOptions'
    );
  }

  /**
   * Authenticate with passkey (login)
   * Full passkey login flow: get options → prompt authenticator → verify with server
   */
  async authenticateWithPasskey(): Promise<{
    token: string;
    accessToken: string;
    refreshToken: string;
    user: { id: string; username: string; displayName?: string; avatar?: string; role: string };
  }> {
    // Step 1: Get authentication options from server
    const options = await this.getAuthenticationOptions();

    // Step 2: Prompt user to authenticate with their passkey
    const publicKey = this.prepareAuthenticationOptions(options);

    const assertion = (await navigator.credentials.get({
      publicKey,
    })) as PublicKeyCredential;

    if (!assertion) {
      throw new Error('Authentication cancelled');
    }

    // Step 3: Prepare assertion response for server
    const assertionResponse = this.prepareAssertionResponse(assertion);

    // Step 4: Send to server for verification and token issuance (public endpoint)
    let body: Record<string, unknown>;
    try {
      body = await apiClient.postRaw<Record<string, unknown>>(
        '/api/v2/webauthn/authenticate/verify',
        {
          credential: assertionResponse,
          challengeKey: options._challengeKey,
        }
      );
    } catch (err) {
      let serverMessage: string | undefined;
      if (isApiClientError(err)) {
        serverMessage = (err.details as { message?: string } | undefined)?.message ?? err.message;
      } else if (err instanceof Error) {
        serverMessage = err.message;
      }
      // Map backend error messages to user-friendly messages
      const message =
        serverMessage === 'Credential not found'
          ? 'This passkey is not recognized. It may have been removed or registered on a different device. Please try another login method or re-register your passkey.'
          : serverMessage || 'Passkey verification failed';
      throw new Error(message);
    }

    return unwrapEnvelope<{
      token: string;
      accessToken: string;
      refreshToken: string;
      user: { id: string; username: string; displayName?: string; avatar?: string; role: string };
    }>(body, 'authenticateWithPasskey');
  }

  // ==================== STEP-UP VERIFICATION ====================

  /**
   * Get step-up verification options for destructive action confirmation
   * Requires authenticated session
   */
  async getStepUpOptions(): Promise<{
    required: boolean;
    methods: string[];
    passkeyOptions?: AuthenticationOptions;
  }> {
    const response = await apiClient.post('/api/v2/webauthn/step-up/options');
    return unwrapEnvelope<{
      required: boolean;
      methods: string[];
      passkeyOptions?: AuthenticationOptions;
    }>(response, 'getStepUpOptions');
  }

  /**
   * Verify step-up with passkey for destructive actions
   */
  async verifyStepUpWithPasskey(
    passkeyOptions: AuthenticationOptions & { _challengeKey?: string }
  ): Promise<{ verified: boolean; method: string }> {
    const publicKey = this.prepareAuthenticationOptions(passkeyOptions);

    const assertion = (await navigator.credentials.get({
      publicKey,
    })) as PublicKeyCredential;

    if (!assertion) {
      throw new Error('Verification cancelled');
    }

    const assertionResponse = this.prepareAssertionResponse(assertion);

    const response = await apiClient.post('/api/v2/webauthn/step-up/verify', {
      method: 'passkey',
      credential: assertionResponse,
      challengeKey: passkeyOptions._challengeKey,
    });

    return unwrapEnvelope<{ verified: boolean; method: string }>(
      response,
      'verifyStepUpWithPasskey'
    );
  }

  /**
   * Verify step-up with TOTP code for destructive actions
   */
  async verifyStepUpWithTotp(totpCode: string): Promise<{ verified: boolean; method: string }> {
    const response = await apiClient.post('/api/v2/webauthn/step-up/verify', {
      method: 'totp',
      totpCode,
    });

    return unwrapEnvelope<{ verified: boolean; method: string }>(response, 'verifyStepUpWithTotp');
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Prepare authentication options for WebAuthn API (get assertion)
   */
  private prepareAuthenticationOptions(
    options: AuthenticationOptions
  ): PublicKeyCredentialRequestOptions {
    return {
      challenge: this.base64urlToBuffer(options.challenge),
      timeout: options.timeout,
      rpId: options.rpId,
      allowCredentials: options.allowCredentials?.map(cred => ({
        id: this.base64urlToBuffer(cred.id),
        type: cred.type as PublicKeyCredentialType,
        transports: cred.transports as AuthenticatorTransport[],
      })),
      userVerification: options.userVerification as UserVerificationRequirement,
    };
  }

  /**
   * Prepare assertion response for server
   */
  private prepareAssertionResponse(assertion: PublicKeyCredential): unknown {
    const response = assertion.response as AuthenticatorAssertionResponse;

    return {
      id: assertion.id,
      rawId: this.bufferToBase64url(assertion.rawId),
      type: assertion.type,
      response: {
        authenticatorData: this.bufferToBase64url(response.authenticatorData),
        clientDataJSON: this.bufferToBase64url(response.clientDataJSON),
        signature: this.bufferToBase64url(response.signature),
        userHandle: response.userHandle ? this.bufferToBase64url(response.userHandle) : null,
      },
    };
  }
}

export const webAuthnService = new WebAuthnService();
