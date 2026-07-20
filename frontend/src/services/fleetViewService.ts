import { apiClient } from './apiClient';

/**
 * FleetView schema types for frontend
 */
export interface FleetViewShip {
  name: string;
  manufacturer?: string;
  kind?: string;
  owned?: number;
  warbond?: boolean;
  lti?: boolean;
  contains?: string[];
  pledge?: string;
  cost?: number;
  notes?: string;
  tags?: string[];
}

export interface FleetViewSchema {
  version?: string;
  updated?: string;
  owner?: {
    name?: string;
    handle?: string;
    orgName?: string;
    orgSid?: string;
  };
  ships: FleetViewShip[];
  statistics?: {
    totalShips?: number;
    totalValue?: number;
    manufacturers?: Record<string, number>;
    roles?: Record<string, number>;
  };
}

export interface FleetViewImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  ships: Array<{
    name: string;
    status: 'imported' | 'skipped' | 'error';
    message?: string;
  }>;
}

export interface FleetViewValidationResult {
  valid: boolean;
  error?: string;
  shipCount?: number;
  message?: string;
}

/**
 * FleetView API Service
 * Handles import/export of fleet data in FleetView format
 * Compatible with hangar.link/fleet/canvas
 */
class FleetViewService {
  /**
   * Export user's personal fleet to FleetView format
   */
  async exportUserFleet(options?: {
    includeStatistics?: boolean;
    includeInactive?: boolean;
  }): Promise<FleetViewSchema> {
    const params = new URLSearchParams();
    if (options?.includeStatistics !== undefined) {
      params.append('includeStatistics', String(options.includeStatistics));
    }
    if (options?.includeInactive) {
      params.append('includeInactive', 'true');
    }

    const queryString = params.toString();
    const url = queryString
      ? `/api/v2/fleet/export/user?${queryString}`
      : '/api/v2/fleet/export/user';
    const response = await apiClient.get<FleetViewSchema>(url);
    return response.data;
  }

  /**
   * Export organization fleet to FleetView format (org leads only)
   */
  async exportOrgFleet(
    organizationId: string,
    options?: {
      includeStatistics?: boolean;
      includeInactive?: boolean;
    }
  ): Promise<FleetViewSchema> {
    const params = new URLSearchParams();
    if (options?.includeStatistics !== undefined) {
      params.append('includeStatistics', String(options.includeStatistics));
    }
    if (options?.includeInactive) {
      params.append('includeInactive', 'true');
    }

    const queryString = params.toString();
    const url = queryString
      ? `/api/v2/fleet/export/org/${organizationId}?${queryString}`
      : `/api/v2/fleet/export/org/${organizationId}`;
    const response = await apiClient.get<FleetViewSchema>(url);
    return response.data;
  }

  /**
   * Import ships to user's personal fleet from FleetView format
   */
  async importUserFleet(
    file: File,
    options?: {
      merge?: boolean;
      skipDuplicates?: boolean;
    }
  ): Promise<FleetViewImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.merge !== undefined) {
      formData.append('merge', String(options.merge));
    }
    if (options?.skipDuplicates !== undefined) {
      formData.append('skipDuplicates', String(options.skipDuplicates));
    }

    const response = await apiClient.post<FleetViewImportResult>(
      '/api/v2/fleet/import/user',
      formData
    );
    return response.data;
  }

  /**
   * Import ships to organization fleet from FleetView format (org leads only)
   */
  async importOrgFleet(
    organizationId: string,
    file: File,
    options?: {
      merge?: boolean;
      skipDuplicates?: boolean;
    }
  ): Promise<FleetViewImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.merge !== undefined) {
      formData.append('merge', String(options.merge));
    }
    if (options?.skipDuplicates !== undefined) {
      formData.append('skipDuplicates', String(options.skipDuplicates));
    }

    const response = await apiClient.post<FleetViewImportResult>(
      `/api/v2/fleet/import/org/${organizationId}`,
      formData
    );
    return response.data;
  }

  /**
   * Validate FleetView schema without importing
   */
  async validateSchema(file: File): Promise<FleetViewValidationResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<FleetViewValidationResult>(
      '/api/v2/fleet/validate',
      formData
    );
    return response.data;
  }

  /**
   * Download FleetView JSON file
   */
  downloadFleetViewFile(schema: FleetViewSchema, filename: string): void {
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const fleetViewService = new FleetViewService();
