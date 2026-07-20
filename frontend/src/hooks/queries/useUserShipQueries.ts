/**
 * User Ship (Personal Hangar) Query Hooks
 *
 * TanStack Query hooks for personal ship management (CRUD, loans).
 */

import { extractArrayFromEnvelope, extractPaginationMeta } from '@/services/baseService';
import { userShipService, type UserShipSummary } from '@/services/userShipService';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { userShipKeys } from './queryKeys';

export type { UserShipSummary } from '@/services/userShipService';

/** Shape of a user ship as returned by the getUserShips API */
export interface PersonalShip {
  id: string;
  shipName: string;
  customName?: string;
  status: string;
  condition: string;
  location?: string;
  description?: string;
  insuranceLevel?: string;
  needsInsuranceRenewal?: boolean;
  sharingLevel: string;
  sharedWithUsers?: string[];
  erkulLoadoutUrl?: string;
  /** Production status from the ship catalog (flight_ready, in_concept, etc.) */
  productionStatus?: string;
}

// ============================================================================
// Query Hooks
// ============================================================================

/** Shape of the paginated ship response from useUserShips */
export interface UserShipsResult {
  items: PersonalShip[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Fetch + envelope-unwrap the current user's ships. Exported so the
 * PersonalHangar route loader can hydrate the React Query cache under the
 * same key shape that {@link useUserShips} reads — keeping them in sync
 * means the page renders from cache without a second request.
 */
export async function fetchUserShips(filters: Record<string, unknown>): Promise<UserShipsResult> {
  const response = await userShipService.getUserShips(filters);
  const items = extractArrayFromEnvelope<PersonalShip>(response, 'items');
  const pagination = extractPaginationMeta(response);
  return {
    items,
    total: pagination?.total ?? items.length,
    page: pagination?.page ?? 1,
    totalPages: pagination?.totalPages ?? 1,
  };
}

/**
 * Fetch the current user's ships with optional filters and pagination.
 */
export function useUserShips(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: userShipKeys.list(filters),
    enabled: !!filters,
    placeholderData: keepPreviousData,
    queryFn: () => fetchUserShips(filters ?? {}),
  });
}

/** Fetch the user ship summary (breakdowns by size/role/manufacturer) */
export function useUserShipSummary() {
  return useQuery<UserShipSummary>({
    queryKey: userShipKeys.summary(),
    queryFn: () => userShipService.getUserShipSummary('me'),
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/** Create a single user ship */
export function useCreateUserShip() {
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Record<string, unknown> }) =>
      userShipService.createUserShip(userId, data),
    meta: { invalidates: [userShipKeys.all] },
  });
}

/** Batch-import ships via bulk endpoint (single request) */
export function useImportUserShips() {
  return useMutation({
    mutationFn: async ({ userId, ships }: { userId: string; ships: Record<string, unknown>[] }) => {
      return userShipService.bulkImportShips(userId, ships);
    },
    meta: { invalidates: [userShipKeys.all] },
  });
}

/** Update a user ship */
export function useUpdateUserShip() {
  return useMutation({
    mutationFn: ({
      userId,
      shipId,
      data,
    }: {
      userId: string;
      shipId: string;
      data: Record<string, unknown>;
    }) => userShipService.updateUserShip(userId, shipId, data),
    meta: { invalidates: [userShipKeys.all] },
  });
}

/** Delete a user ship */
export function useDeleteUserShip() {
  return useMutation({
    mutationFn: ({ userId, shipId }: { userId: string; shipId: string }) =>
      userShipService.deleteUserShip(userId, shipId),
    meta: { invalidates: [userShipKeys.all] },
  });
}

/** Loan a user ship to another user */
export function useLoanUserShip() {
  return useMutation({
    mutationFn: ({
      userId,
      shipId,
      data,
    }: {
      userId: string;
      shipId: string;
      data: Record<string, unknown>;
    }) => userShipService.loanShip(userId, shipId, data),
    meta: { invalidates: [userShipKeys.all] },
  });
}
