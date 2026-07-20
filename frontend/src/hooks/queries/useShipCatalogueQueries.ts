/**
 * React Query hooks for ship catalogue data (reference data).
 *
 * Provides cached, deduplicated access to the ship catalogue and roles.
 * Replaces manual useState+useEffect patterns in ShipRequirementsEditor
 * and other components that need catalogue data.
 */
import { useQuery } from '@tanstack/react-query';

import { shipCatalogueService, type ShipCatalogueResponse } from '@/services/shipCatalogueService';

import { shipKeys } from './queryKeys';

/**
 * Fetch the ship catalogue. Cached for 10 minutes since it's reference data.
 */
export function useShipCatalogue(params?: { limit?: number }, enabled = true) {
  return useQuery<ShipCatalogueResponse>({
    queryKey: [...shipKeys.catalog(), params?.limit ?? 500],
    queryFn: () => shipCatalogueService.getShips(params ?? { limit: 500 }),
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Fetch available ship roles. Cached for 10 minutes since it's reference data.
 */
export function useShipRoles(enabled = true) {
  return useQuery<string[]>({
    queryKey: shipKeys.roles(),
    queryFn: () => shipCatalogueService.getRoles(),
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
