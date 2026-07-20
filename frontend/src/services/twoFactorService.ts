/**
 * Two-Factor Authentication Service
 *
 * API client for managing 2FA setup, verification, and backup codes.
 */

import { apiClient } from './apiClient';

export interface TwoFactorStatus {
  twoFactorEnabled: boolean;
  hasBackupCodes: boolean;
  backupCodesCount: number;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorVerification {
  verified: boolean;
  message?: string;
}

/**
 * Two-Factor Authentication Service
 * Provides methods for managing 2FA configuration
 */
export class TwoFactorService {
  /**
   * Get current 2FA status for the authenticated user
   */
  async getStatus(): Promise<TwoFactorStatus> {
    const response = await apiClient.get('/api/v2/2fa/status');
    // apiClient.get() returns the response body; data may be nested in envelope or flat
    const body = response as unknown as Record<string, unknown>;
    return (body.data ?? body) as TwoFactorStatus;
  }

  /**
   * Setup 2FA - generates secret and QR code
   * Step 1 of enabling 2FA
   */
  async setup(): Promise<TwoFactorSetup> {
    const response = await apiClient.post('/api/v2/2fa/setup');
    const body = response as unknown as Record<string, unknown>;
    return (body.data ?? body) as TwoFactorSetup;
  }

  /**
   * Verify and enable 2FA with TOTP token
   * Step 2 of enabling 2FA - sends both the verification token and backup codes from setup
   */
  async verifyAndEnable(token: string, backupCodes: string[]): Promise<TwoFactorVerification> {
    const response = await apiClient.post('/api/v2/2fa/verify', { token, backupCodes });
    const body = response as unknown as Record<string, unknown>;
    return (body.data ?? body) as TwoFactorVerification;
  }

  /**
   * Disable 2FA (requires current password or 2FA token)
   */
  async disable(password: string, token?: string): Promise<{ message: string }> {
    const response = await apiClient.post('/api/v2/2fa/disable', {
      password,
      token,
    });
    const body = response as unknown as Record<string, unknown>;
    return (body.data ?? body) as { message: string };
  }

  /**
   * Generate new backup codes (invalidates old ones)
   */
  async regenerateBackupCodes(token: string): Promise<{ backupCodes: string[] }> {
    const response = await apiClient.post('/api/v2/2fa/backup-codes', { token });
    const body = response as unknown as Record<string, unknown>;
    return (body.data ?? body) as { backupCodes: string[] };
  }
}

export const twoFactorService = new TwoFactorService();
