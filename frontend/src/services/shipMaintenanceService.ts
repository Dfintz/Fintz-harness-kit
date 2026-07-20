import type {
  CreateShipMaintenanceRequest,
  MaintenanceSummary,
  ShipMaintenance,
  UpdateShipMaintenanceRequest,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

class ShipMaintenanceService extends BaseService {
  protected basePath = '/api/v2/ship-maintenance';

  async list(): Promise<ShipMaintenance[]> {
    try {
      this.log('list');
      const response = await apiClient.get<ShipMaintenance[]>(this.basePath);
      return response.data;
    } catch (error) {
      this.handleError(error, 'list');
    }
  }

  async getById(id: string): Promise<ShipMaintenance> {
    try {
      this.log('getById', id);
      const response = await apiClient.get<ShipMaintenance>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  async getUpcoming(): Promise<ShipMaintenance[]> {
    try {
      this.log('getUpcoming');
      const response = await apiClient.get<ShipMaintenance[]>(`${this.basePath}/upcoming`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getUpcoming');
    }
  }

  async getOverdue(): Promise<ShipMaintenance[]> {
    try {
      this.log('getOverdue');
      const response = await apiClient.get<ShipMaintenance[]>(`${this.basePath}/overdue`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getOverdue');
    }
  }

  async schedule(payload: CreateShipMaintenanceRequest): Promise<ShipMaintenance> {
    try {
      this.log('schedule', payload);
      const response = await apiClient.post<ShipMaintenance>(this.basePath, payload);
      return response.data;
    } catch (error) {
      this.handleError(error, 'schedule');
    }
  }

  async updateStatus(
    id: string,
    status: UpdateShipMaintenanceRequest['status']
  ): Promise<ShipMaintenance> {
    try {
      this.log('updateStatus', { id, status });
      const response = await apiClient.put<ShipMaintenance>(`${this.basePath}/${id}/status`, {
        status,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateStatus');
    }
  }

  async getSummary(): Promise<MaintenanceSummary> {
    try {
      this.log('getSummary');
      const [all, _upcoming, overdue] = await Promise.all([
        this.list(),
        this.getUpcoming(),
        this.getOverdue(),
      ]);

      return {
        total: all.length,
        scheduled: all.filter(item => item.status === 'scheduled').length,
        inProgress: all.filter(item => item.status === 'in_progress').length,
        completed: all.filter(item => item.status === 'completed').length,
        cancelled: all.filter(item => item.status === 'cancelled').length,
        overdue: overdue.length,
      };
    } catch (error) {
      this.handleError(error, 'getSummary');
    }
  }
}

export const shipMaintenanceService = new ShipMaintenanceService();
