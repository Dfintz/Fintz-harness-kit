/**
 * Authentication Service Module
 * 
 * Unified authentication service that consolidates token management,
 * session management, and security features.
 * 
 * Includes:
 * - AuthenticationService: Core JWT and session management
 * - TwoFactorService: TOTP-based two-factor authentication
 * - PasswordResetService: Password reset via email
 * - WebAuthnService: FIDO2/WebAuthn passwordless authentication
 * - PasswordlessService: Magic link and code-based authentication
 * 
 * @module services/authentication
 */

export { AuthenticationService } from './AuthenticationService';
export { OAuthLinkingService } from './OAuthLinkingService';
export { PasswordlessService } from './PasswordlessService';
export { PasswordResetService } from './PasswordResetService';
export { TwoFactorService } from './TwoFactorService';
export { WebAuthnService } from './WebAuthnService';

export type {
    AuthConfig, AuthTokens, RefreshTokenInfo, SessionInfo, SessionMetadata, TokenPayload
} from './AuthenticationService';

export type {
    OAuthLinkResult, OAuthUserResolutionOpts
} from './OAuthLinkingService';

export type {
    WebAuthnAuthenticationOptionsWithKey, WebAuthnAuthenticationResult, WebAuthnConfig, WebAuthnCredentialInfo, WebAuthnRegistrationResult, WebAuthnSessionMetadata
} from './WebAuthnService';

export type {
    PasswordlessConfig, PasswordlessSessionMetadata, SendCodeResult, SendMagicLinkResult, VerifyTokenResult
} from './PasswordlessService';


