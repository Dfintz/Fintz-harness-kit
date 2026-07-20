import type {
  CreateWebhookRequest,
  UpdateWebhookRequest,
  Webhook,
  WebhookEventType,
  WebhookTestResult,
  WebhookV2,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

interface WebhookStats {
  total: number;
  active: number;
  inactive: number;
  error: number;
}

class WebhookService extends BaseService {
  protected basePath = '/api/v2/webhooks';

  async list(): Promise<WebhookV2[]> {
    try {
      this.log('list');
      const response = await apiClient.get<WebhookV2[]>(this.basePath);
      // Handle both envelope shapes: { data: [...] } or direct array
      const payload = response?.data;
      return Array.isArray(payload) ? payload : [];
    } catch (error) {
      this.handleError(error, 'list');
    }
  }

  async getById(webhookId: string): Promise<WebhookV2> {
    try {
      this.log('getById', webhookId);
      const response = await apiClient.get<WebhookV2>(`${this.basePath}/${webhookId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  async create(payload: CreateWebhookRequest): Promise<Webhook> {
    try {
      this.log('create', payload);
      const response = await apiClient.post<Webhook>(this.basePath, payload);
      return response.data;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  async update(webhookId: string, payload: UpdateWebhookRequest): Promise<Webhook> {
    try {
      this.log('update', { webhookId, payload });
      const response = await apiClient.put<Webhook>(`${this.basePath}/${webhookId}`, payload);
      return response.data;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  async delete(webhookId: string): Promise<void> {
    try {
      this.log('delete', webhookId);
      await apiClient.delete(`${this.basePath}/${webhookId}`);
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  async test(webhookId: string): Promise<WebhookTestResult> {
    try {
      this.log('test', webhookId);
      const response = await apiClient.post<WebhookTestResult>(
        `${this.basePath}/${webhookId}/test`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'test');
    }
  }

  async getStats(): Promise<WebhookStats> {
    try {
      this.log('getStats');
      const response = await apiClient.get<WebhookStats>(`${this.basePath}/statistics`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getStats');
    }
  }

  async getEventTypes(): Promise<WebhookEventType[]> {
    try {
      this.log('getEventTypes');
      const response = await apiClient.get<WebhookEventType[]>(`${this.basePath}/event-types`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getEventTypes');
    }
  }
}

export const webhookService = new WebhookService();
