import type {
  CreateShipLoanRequest,
  ShipLoan,
  UpdateShipLoanRequest,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

class ShipLoanService extends BaseService {
  protected basePath = '/api/v2/ship-loans';

  async list(): Promise<ShipLoan[]> {
    try {
      this.log('list');
      const response = await apiClient.get<ShipLoan[]>(this.basePath);
      return response.data;
    } catch (error) {
      this.handleError(error, 'list');
    }
  }

  async getById(id: string): Promise<ShipLoan> {
    try {
      this.log('getById', id);
      const response = await apiClient.get<ShipLoan>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  async create(payload: CreateShipLoanRequest): Promise<ShipLoan> {
    try {
      this.log('create', payload);
      const response = await apiClient.post<ShipLoan>(this.basePath, payload);
      return response.data;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  async update(id: string, payload: UpdateShipLoanRequest): Promise<ShipLoan> {
    try {
      this.log('update', { id, payload });
      const response = await apiClient.put<ShipLoan>(`${this.basePath}/${id}`, payload);
      return response.data;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  async approve(id: string): Promise<ShipLoan> {
    try {
      this.log('approve', id);
      const response = await apiClient.post<ShipLoan>(`${this.basePath}/${id}/approve`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'approve');
    }
  }

  async activate(id: string): Promise<ShipLoan> {
    try {
      this.log('activate', id);
      const response = await apiClient.post<ShipLoan>(`${this.basePath}/${id}/activate`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'activate');
    }
  }

  async returnLoan(id: string): Promise<ShipLoan> {
    try {
      this.log('returnLoan', id);
      const response = await apiClient.post<ShipLoan>(`${this.basePath}/${id}/return`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'returnLoan');
    }
  }

  async decline(id: string): Promise<ShipLoan> {
    try {
      this.log('decline', id);
      const response = await apiClient.post<ShipLoan>(`${this.basePath}/${id}/decline`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'decline');
    }
  }

  async getOrgLoanHistory(
    orgId: string,
    status?: string
  ): Promise<{ data: ShipLoan[]; pagination?: Record<string, number> }> {
    try {
      this.log('getOrgLoanHistory', { orgId, status });
      const params = status ? `?status=${status}` : '';
      const response = await apiClient.get<ShipLoan[]>(
        `${this.basePath}/organization/${orgId}${params}`
      );
      const envelope = response.data;
      return {
        data: Array.isArray(envelope) ? envelope : [],
        pagination: undefined,
      };
    } catch (error) {
      this.handleError(error, 'getOrgLoanHistory');
    }
  }
}

export const shipLoanService = new ShipLoanService();
