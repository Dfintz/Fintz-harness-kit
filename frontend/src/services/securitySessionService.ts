import type {
  AccountAccessLog,
  RevokeTrustedDeviceRequest,
  TrustedDevice,
  UserLoginSession,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

class SecuritySessionService extends BaseService {
  protected basePath = '/api/v2/users/me';

  async getSessions(): Promise<UserLoginSession[]> {
    try {
      this.log('getSessions');
      const response = await apiClient.get<UserLoginSession[]>(`${this.basePath}/sessions`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getSessions');
    }
  }

  async getTrustedDevices(): Promise<TrustedDevice[]> {
    try {
      this.log('getTrustedDevices');
      const response = await apiClient.get<TrustedDevice[]>(`${this.basePath}/trusted-devices`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getTrustedDevices');
    }
  }

  async revokeSession(sessionId: number | string): Promise<void> {
    try {
      this.log('revokeSession', sessionId);
      await apiClient.delete(`${this.basePath}/sessions/${sessionId}`);
    } catch (error) {
      this.handleError(error, 'revokeSession');
    }
  }

  async revokeTrustedDevice(payload: RevokeTrustedDeviceRequest): Promise<void> {
    try {
      this.log('revokeTrustedDevice', payload);
      await apiClient.delete(`${this.basePath}/trusted-devices/${payload.trustedDeviceId}`);
    } catch (error) {
      this.handleError(error, 'revokeTrustedDevice');
    }
  }

  async getAccessLog(limit = 50, offset = 0): Promise<AccountAccessLog[]> {
    try {
      this.log('getAccessLog', { limit, offset });
      const query = this.buildQueryString({ limit, offset });
      const response = await apiClient.get<AccountAccessLog[]>(
        `${this.basePath}/access-logs${query}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAccessLog');
    }
  }
}

export const securitySessionService = new SecuritySessionService();
