import {
  organizationShipService,
  type CreateOrgShipInput,
} from '@/services/organizationShipService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationKeys, shipKeys } from './queryKeys';

/**
 * TanStack Query hooks for organization ship operations
 */

interface OrgShipFilters {
  role?: string;
  status?: string;
  condition?: string;
  isAvailable?: boolean;
  isCapital?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

interface OrgShipMutationVars {
  orgId: string;
  shipId: string;
}

interface UpdateOrgShipVars extends OrgShipMutationVars {
  updates: Record<string, unknown>;
}

interface AssignCaptainVars extends OrgShipMutationVars {
  captainId: string;
}

interface AssignCrewVars extends OrgShipMutationVars {
  crewIds: string[];
}

interface AddCrewMemberVars extends OrgShipMutationVars {
  userId: string;
}

/**
 * Fetch organization ships with filters
 */
export function useOrgShips(orgId: string, filters: OrgShipFilters = {}) {
  return useQuery({
    queryKey: organizationKeys.ships(orgId, filters as Record<string, unknown>),
    queryFn: () => organizationShipService.getOrgShips(orgId, filters as Record<string, unknown>),
    enabled: !!orgId,
  });
}

/**
 * Fetch fleet summary statistics
 */
export function useFleetSummary(orgId: string) {
  return useQuery({
    queryKey: organizationKeys.fleetSummary(orgId),
    queryFn: () => organizationShipService.getFleetSummary(orgId),
    enabled: !!orgId,
  });
}

/**
 * Fetch single organization ship by ID
 */
export function useOrgShip(orgId: string, shipId: string) {
  return useQuery({
    queryKey: organizationKeys.ship(orgId, shipId),
    queryFn: () => organizationShipService.getOrgShipById(orgId, shipId),
    enabled: !!orgId && !!shipId,
  });
}

/**
 * Create organization ship mutation
 */
export function useCreateOrgShip() {
  return useMutation({
    mutationFn: ({ orgId, shipData }: { orgId: string; shipData: CreateOrgShipInput }) =>
      organizationShipService.createOrgShip(orgId, shipData),
    meta: {
      invalidates: (_data, { orgId }: { orgId: string; shipData: CreateOrgShipInput }) => [
        organizationKeys.ships(orgId),
        organizationKeys.fleetSummary(orgId),
        shipKeys.lists(),
      ],
    },
  });
}

/**
 * Update organization ship mutation.
 *
 * NOTE: ship metadata / loadout are JSONB columns. Invalidate-and-refetch
 * (no setQueryData) avoids the "ship setting snaps back" class of bugs — see
 * /memories/repo/typeorm-jsonb-pitfall.md.
 */
export function useUpdateOrgShip() {
  return useMutation({
    mutationFn: ({ orgId, shipId, updates }: UpdateOrgShipVars) =>
      organizationShipService.updateOrgShip(orgId, shipId, updates),
    meta: {
      invalidates: (_data, { orgId, shipId }: UpdateOrgShipVars) => [
        organizationKeys.ship(orgId, shipId),
        organizationKeys.ships(orgId),
        organizationKeys.fleetSummary(orgId),
        shipKeys.lists(),
      ],
    },
  });
}

/**
 * Delete organization ship mutation.
 *
 * Keeps `onSuccess` to `removeQueries` for the deleted detail (invalidate
 * would re-fetch and 404). List + summary invalidations route through the
 * central handler.
 */
export function useDeleteOrgShip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, shipId }: OrgShipMutationVars) =>
      organizationShipService.deleteOrgShip(orgId, shipId),
    onSuccess: (_data, { orgId, shipId }) => {
      queryClient.removeQueries({ queryKey: organizationKeys.ship(orgId, shipId) });
    },
    meta: {
      invalidates: (_data, { orgId }: OrgShipMutationVars) => [
        organizationKeys.ships(orgId),
        organizationKeys.fleetSummary(orgId),
        shipKeys.lists(),
      ],
    },
  });
}

/**
 * Assign captain to ship mutation
 */
export function useAssignCaptain() {
  return useMutation({
    mutationFn: ({ orgId, shipId, captainId }: AssignCaptainVars) =>
      organizationShipService.assignCaptain(orgId, shipId, captainId),
    meta: {
      invalidates: (_data, { orgId, shipId }: AssignCaptainVars) => [
        organizationKeys.ship(orgId, shipId),
        organizationKeys.ships(orgId),
      ],
    },
  });
}

/**
 * Assign crew to ship mutation
 */
export function useAssignCrew() {
  return useMutation({
    mutationFn: ({ orgId, shipId, crewIds }: AssignCrewVars) =>
      organizationShipService.assignCrew(orgId, shipId, crewIds),
    meta: {
      invalidates: (_data, { orgId, shipId }: AssignCrewVars) => [
        organizationKeys.ship(orgId, shipId),
        organizationKeys.ships(orgId),
      ],
    },
  });
}

/**
 * Add crew member to ship mutation
 */
export function useAddCrewMember() {
  return useMutation({
    mutationFn: ({ orgId, shipId, userId }: AddCrewMemberVars) =>
      organizationShipService.addCrewMember(orgId, shipId, userId),
    meta: {
      invalidates: (_data, { orgId, shipId }: AddCrewMemberVars) => [
        organizationKeys.ship(orgId, shipId),
        organizationKeys.ships(orgId),
      ],
    },
  });
}

/**
 * Loan an org ship to a user
 */
export function useLoanOrgShip() {
  return useMutation({
    mutationFn: ({
      orgId,
      shipId,
      data,
    }: {
      orgId: string;
      shipId: string;
      data: { borrowerId: string; purpose?: string };
    }) => organizationShipService.loanOrgShip(orgId, shipId, data),
    meta: {
      invalidates: (_data, variables) => [
        organizationKeys.ships(variables.orgId),
        organizationKeys.fleetSummary(variables.orgId),
      ],
    },
  });
}

/**
 * Return a loaned org ship
 */
export function useReturnOrgShipLoan() {
  return useMutation({
    mutationFn: ({ orgId, shipId }: { orgId: string; shipId: string }) =>
      organizationShipService.returnOrgShipLoan(orgId, shipId),
    meta: {
      invalidates: (_data, variables) => [
        organizationKeys.ships(variables.orgId),
        organizationKeys.fleetSummary(variables.orgId),
      ],
    },
  });
}
