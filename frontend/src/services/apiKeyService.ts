import { apiClient } from './apiClient';
import { BaseService, extractData } from './baseService';

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  revoked: boolean;
  revokedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface ApiKeyCreatedResponse {
  rawKey: string;
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
}

/**
 * API Key Service
 *
 * Manages user API keys for external integrations (Wingman AI, etc.).
 */
class ApiKeyService extends BaseService {
  protected basePath = '/api/v2/api-keys';

  async listKeys(): Promise<ApiKeyInfo[]> {
    try {
      this.log('listKeys');
      const response = await apiClient.get<ApiKeyInfo[]>(this.basePath);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'listKeys');
    }
  }

  async createKey(data: {
    name: string;
    scopes: string[];
    expiresInDays?: number;
  }): Promise<ApiKeyCreatedResponse> {
    try {
      this.log('createKey', { name: data.name });
      const response = await apiClient.post<ApiKeyCreatedResponse>(this.basePath, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'createKey');
    }
  }

  async getKey(keyId: string): Promise<ApiKeyInfo> {
    try {
      this.log('getKey', { keyId });
      const response = await apiClient.get<ApiKeyInfo>(`${this.basePath}/${keyId}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getKey');
    }
  }

  async updateKey(keyId: string, data: { name?: string; scopes?: string[] }): Promise<ApiKeyInfo> {
    try {
      this.log('updateKey', { keyId });
      const response = await apiClient.put<ApiKeyInfo>(`${this.basePath}/${keyId}`, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateKey');
    }
  }

  async revokeKey(keyId: string): Promise<{ revoked: boolean }> {
    try {
      this.log('revokeKey', { keyId });
      const response = await apiClient.delete<{ revoked: boolean }>(`${this.basePath}/${keyId}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'revokeKey');
    }
  }
}

export const apiKeyService = new ApiKeyService();
