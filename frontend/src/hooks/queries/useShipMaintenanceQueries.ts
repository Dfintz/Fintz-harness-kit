/**
 * Ship Maintenance Query Hooks — Sprint 22-F React Query Migration
 *
 * TanStack Query hooks for ship maintenance management with automatic caching,
 * background refetching, and cache invalidation.
 */

import { shipMaintenanceService } from '@/services/shipMaintenanceService';
import type {
  CreateShipMaintenanceRequest,
  MaintenanceSummary,
  ShipMaintenance,
  UpdateShipMaintenanceRequest,
} from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { shipMaintenanceKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all maintenance records
 */
export function useMaintenanceList(
  options?: Omit<UseQueryOptions<ShipMaintenance[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shipMaintenanceKeys.lists(),
    queryFn: () => shipMaintenanceService.list(),
    ...options,
  });
}

/**
 * Hook to fetch a single maintenance record by ID
 */
export function useMaintenanceDetail(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ShipMaintenance>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shipMaintenanceKeys.detail(id ?? ''),
    queryFn: () => shipMaintenanceService.getById(id ?? ''),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to fetch upcoming maintenance records
 */
export function useUpcomingMaintenance(
  options?: Omit<UseQueryOptions<ShipMaintenance[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shipMaintenanceKeys.upcoming(),
    queryFn: () => shipMaintenanceService.getUpcoming(),
    ...options,
  });
}

/**
 * Hook to fetch overdue maintenance records
 */
export function useOverdueMaintenance(
  options?: Omit<UseQueryOptions<ShipMaintenance[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shipMaintenanceKeys.overdue(),
    queryFn: () => shipMaintenanceService.getOverdue(),
    ...options,
  });
}

/**
 * Hook to fetch the maintenance summary
 */
export function useMaintenanceSummary(
  options?: Omit<UseQueryOptions<MaintenanceSummary>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shipMaintenanceKeys.summary(),
    queryFn: () => shipMaintenanceService.getSummary(),
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to schedule new maintenance
 */
export function useScheduleMaintenance() {  return useMutation({
    mutationFn: (data: CreateShipMaintenanceRequest) => shipMaintenanceService.schedule(data),
    meta: { invalidates: [shipMaintenanceKeys.all] },
  });
}

/**
 * Hook to update maintenance status
 */
export function useUpdateMaintenanceStatus() {  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UpdateShipMaintenanceRequest['status'] }) =>
      shipMaintenanceService.updateStatus(id, status),
    meta: { invalidates: [shipMaintenanceKeys.all] },
  });
}
