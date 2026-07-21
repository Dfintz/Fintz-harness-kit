/**
 * Security session and account access tracking types.
 */

export type TrustLevel = 'low' | 'medium' | 'high';

export type VerificationMethod = 'email' | '2fa' | 'sso';
export type AccountAccessAction = 'view' | 'password_reveal' | 'update' | 'delete' | (string & {});

export interface TrustedDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  lastUsed: Date | string;
  isActive: boolean;
  trustLevel: TrustLevel;
  verificationMethod?: VerificationMethod;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserLoginSession {
  id: number;
  userId: number;
  sessionToken: string;
  discordTokenExpiry: Date | string;
  isActive: boolean;
  createdAt: Date | string;
  lastActivity: Date | string;
  expiresAt: Date | string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AccountAccessLog {
  id: string;
  accountId: string;
  userId: string;
  organizationId: string;
  action: AccountAccessAction;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
}

export interface RevokeSessionRequest {
  sessionId: number;
}

export interface RevokeTrustedDeviceRequest {
  trustedDeviceId: string;
}
