/**
 * Ship maintenance domain types.
 *
 * Per ADR-004, each vocabulary is exposed as a runtime-introspectable `as const`
 * array plus a derived union type, with exact parity to the backend
 * `ShipMaintenance` enums (no client-only exclusions).
 */

/** Canonical maintenance-status values (runtime source set for {@link MaintenanceStatus}). */
export const MAINTENANCE_STATUS_VALUES = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'overdue',
] as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUS_VALUES)[number];

/** Canonical maintenance-type values (runtime source set for {@link MaintenanceType}). */
export const MAINTENANCE_TYPE_VALUES = ['routine', 'repair', 'upgrade', 'inspection'] as const;

export type MaintenanceType = (typeof MAINTENANCE_TYPE_VALUES)[number];

export interface ShipMaintenance {
  id: string;
  shipId: string;
  ownerId: string;
  maintenanceType: MaintenanceType;
  scheduledDate: Date | string;
  completedDate?: Date | string;
  status: MaintenanceStatus;
  description?: string;
  cost?: number;
  performedBy?: string;
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ShipMaintenanceV2 extends ShipMaintenance {
  isOverdue: boolean;
  daysUntilDue: number;
}

export interface CreateShipMaintenanceRequest {
  shipId: string;
  maintenanceType: MaintenanceType;
  scheduledDate: Date | string;
  description?: string;
  cost?: number;
  performedBy?: string;
  notes?: string;
}

export interface UpdateShipMaintenanceRequest extends Partial<CreateShipMaintenanceRequest> {
  completedDate?: Date | string;
  status?: MaintenanceStatus;
}

export interface MaintenanceSummary {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
}
