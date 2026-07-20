import { apiClient } from './apiClient';
import { BaseService } from './baseService';

export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATA_ACCESS = 'DATA_ACCESS',
  PERMISSION = 'PERMISSION',
  ACTIVITY = 'ACTIVITY',
  ORGANIZATION = 'ORGANIZATION',
  RSI_SYNC = 'RSI_SYNC',
  ENCRYPTION = 'ENCRYPTION',
  INTEL = 'INTEL',
  USER = 'USER',
  FLEET = 'FLEET',
  SYSTEM = 'SYSTEM',
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  correlationId: string;
  category: AuditCategory;
  action: string;
  severity: AuditSeverity;
  userId?: string;
  username?: string;
  organizationId?: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  correlationId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

class AuditService extends BaseService {
  protected basePath = '/api/v2/audit';

  async getLogs(filters?: AuditLogFilters): Promise<AuditLogEntry[]> {
    try {
      this.log('getLogs', filters);
      const query = this.buildQueryString(filters as Record<string, unknown>);
      const response = await apiClient.get<AuditLogEntry[]>(`${this.basePath}/logs${query}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getLogs');
    }
  }

  async getLogById(logId: string): Promise<AuditLogEntry> {
    try {
      this.log('getLogById', logId);
      const response = await apiClient.get<AuditLogEntry>(`${this.basePath}/logs/${logId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getLogById');
    }
  }

  async getStatistics(orgId?: string): Promise<AuditStatistics> {
    try {
      this.log('getStatistics', orgId);
      const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
      const response = await apiClient.get<AuditStatistics>(`${this.basePath}/statistics${query}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getStatistics');
    }
  }

  async exportLogs(filters?: {
    startDate?: string;
    endDate?: string;
    category?: AuditCategory;
  }): Promise<{ data: AuditLogEntry[]; exportedAt: string }> {
    try {
      this.log('exportLogs', filters);
      const query = this.buildQueryString(filters);
      const response = await apiClient.get<{ data: AuditLogEntry[]; exportedAt: string }>(
        `${this.basePath}/export${query}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'exportLogs');
    }
  }
}

export const auditService = new AuditService();
