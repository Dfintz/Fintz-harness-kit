import { apiClient } from './apiClient';
import { BaseService } from './baseService';

export interface RsiVerificationInitiationResponse {
  message?: string;
  verificationCode: string;
  verificationUrl?: string;
  expiresAt?: string;
  rsiHandle?: string;
  rsiOrgSid?: string;
  instructions?: string[];
}

export interface RsiVerificationCompletionResponse {
  message?: string;
  verified: boolean;
  rsiHandle?: string;
  displayName?: string;
  rsiOrgSid?: string;
  orgName?: string;
}

class RsiVerificationService extends BaseService {
  protected basePath = '/api/rsi/verify';

  async initiateUserVerification(rsiHandle: string): Promise<RsiVerificationInitiationResponse> {
    try {
      this.log('initiateUserVerification');
      return await apiClient.postRaw<RsiVerificationInitiationResponse>(
        `${this.basePath}/initiate`,
        {
          rsiHandle: rsiHandle.trim(),
        }
      );
    } catch (error: unknown) {
      this.handleError(error, 'initiateUserVerification');
    }
  }

  async completeUserVerification(): Promise<RsiVerificationCompletionResponse> {
    try {
      this.log('completeUserVerification');
      return await apiClient.postRaw<RsiVerificationCompletionResponse>(
        `${this.basePath}/complete`
      );
    } catch (error: unknown) {
      this.handleError(error, 'completeUserVerification');
    }
  }

  async removeUserVerification(): Promise<void> {
    try {
      this.log('removeUserVerification');
      await apiClient.getAxiosInstance().delete(this.basePath);
    } catch (error: unknown) {
      this.handleError(error, 'removeUserVerification');
    }
  }

  async initiateOrganizationVerification(
    orgId: string,
    rsiOrgSid: string
  ): Promise<RsiVerificationInitiationResponse> {
    try {
      this.log('initiateOrganizationVerification', { orgId });
      return await apiClient.postRaw<RsiVerificationInitiationResponse>(
        '/api/v2/rsi/verify/organization/initiate',
        {
          orgId,
          rsiOrgSid: rsiOrgSid.trim(),
        }
      );
    } catch (error: unknown) {
      this.handleError(error, 'initiateOrganizationVerification');
    }
  }

  async completeOrganizationVerification(
    orgId: string
  ): Promise<RsiVerificationCompletionResponse> {
    try {
      this.log('completeOrganizationVerification', { orgId });
      return await apiClient.postRaw<RsiVerificationCompletionResponse>(
        '/api/v2/rsi/verify/organization/complete',
        { orgId }
      );
    } catch (error: unknown) {
      this.handleError(error, 'completeOrganizationVerification');
    }
  }

  async verifyOrganizationByRank(
    orgId: string,
    rsiOrgSid: string
  ): Promise<RsiVerificationCompletionResponse> {
    try {
      this.log('verifyOrganizationByRank', { orgId });
      return await apiClient.postRaw<RsiVerificationCompletionResponse>(
        '/api/v2/rsi/verify/organization/rank',
        {
          orgId,
          rsiOrgSid: rsiOrgSid.trim(),
        }
      );
    } catch (error: unknown) {
      this.handleError(error, 'verifyOrganizationByRank');
    }
  }
}

export const rsiVerificationService = new RsiVerificationService();
