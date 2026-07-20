/**
 * React Query hook for available ships (organization + member shared ships).
 *
 * Provides cached, deduplicated access to the combined ship list
 * used by ShipPickerDialog.
 */
import { useQuery } from '@tanstack/react-query';

import { organizationShipService } from '@/services/organizationShipService';
import { userShipService } from '@/services/userShipService';

import { availableShipKeys } from './queryKeys';

export interface AvailableShip {
  id: string;
  /** Catalog Ship ID (for cross-referencing with fleet ship lists) */
  catalogShipId?: string;
  shipName: string;
  customName?: string;
  manufacturer?: string;
  role?: string;
  size?: string;
  status: string;
  condition: string;
  source: 'org' | 'member';
  ownerName?: string;
}

async function fetchAvailableShips(orgId: string): Promise<AvailableShip[]> {
  const [orgRes, memberRes] = await Promise.all([
    organizationShipService.getOrgShips(orgId),
    userShipService.getOrgAvailableShips(orgId),
  ]);

  const orgArr = Array.isArray(orgRes) ? orgRes : ((orgRes as { data?: unknown[] })?.data ?? []);
  const memberArr = Array.isArray(memberRes)
    ? memberRes
    : ((memberRes as { data?: unknown[] })?.data ?? []);

  const orgShips: AvailableShip[] = (orgArr as Record<string, unknown>[]).map(s => ({
    id: String(s.id),
    catalogShipId: s.shipId ? String(s.shipId) : undefined,
    shipName: String(s.shipName ?? s.name ?? ''),
    customName: s.customName ? String(s.customName) : undefined,
    manufacturer: s.manufacturer ? String(s.manufacturer) : undefined,
    role: s.role ? String(s.role) : undefined,
    size: s.size ? String(s.size) : undefined,
    status: String(s.status ?? 'unknown'),
    condition: String(s.condition ?? 'unknown'),
    source: 'org' as const,
  }));

  const memberShips: AvailableShip[] = (memberArr as Record<string, unknown>[]).map(s => {
    let resolvedOwner: string | undefined;
    if (s.ownerName) {
      resolvedOwner = String(s.ownerName);
    } else if (s.username) {
      resolvedOwner = String(s.username);
    }
    return {
      id: String(s.id),
      catalogShipId: s.shipId ? String(s.shipId) : undefined,
      shipName: String(s.shipName ?? s.name ?? ''),
      customName: s.customName ? String(s.customName) : undefined,
      manufacturer: s.manufacturer ? String(s.manufacturer) : undefined,
      role: s.role ? String(s.role) : undefined,
      size: s.size ? String(s.size) : undefined,
      status: String(s.status ?? 'unknown'),
      condition: String(s.condition ?? 'unknown'),
      source: 'member' as const,
      ownerName: resolvedOwner,
    };
  });

  return [...orgShips, ...memberShips];
}

/**
 * Fetch available ships for fleet assignment from both org and member sources.
 */
export function useAvailableShips(orgId: string | undefined, enabled = true) {
  return useQuery<AvailableShip[]>({
    queryKey: availableShipKeys.orgShips(orgId ?? ''),
    queryFn: () => fetchAvailableShips(orgId ?? ''),
    enabled: !!orgId && enabled,
    staleTime: 2 * 60 * 1000,
  });
}
