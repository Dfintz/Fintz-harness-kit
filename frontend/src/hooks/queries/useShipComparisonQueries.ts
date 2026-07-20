import { useMutation, useQuery } from '@tanstack/react-query';

import {
  shipComparisonService,
  type FleetCompositionAnalysis,
  type QuickComparisonResult,
  type ShipComparisonResult,
  type ShipRoleAnalysis,
} from '@/services/shipComparisonService';
import { shipComparisonKeys } from './queryKeys';

export function useCompareShips(shipIds: string[]) {
  return useQuery<ShipComparisonResult>({
    queryKey: shipComparisonKeys.comparison(shipIds),
    queryFn: () => shipComparisonService.compareShips(shipIds),
    enabled: shipIds.length >= 2,
  });
}

export function useQuickCompare() {
  return useMutation<QuickComparisonResult, Error, { shipId1: string; shipId2: string }>({
    mutationFn: ({ shipId1, shipId2 }) => shipComparisonService.quickCompare(shipId1, shipId2),
  });
}

export function useShipRoleAnalysis(shipId: string | undefined) {
  return useQuery<ShipRoleAnalysis>({
    queryKey: shipComparisonKeys.roles(shipId || ''),
    queryFn: () => shipComparisonService.getShipRoleAnalysis(shipId || ''),
    enabled: Boolean(shipId),
  });
}

export function useSimilarShips(shipId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: shipComparisonKeys.similar(shipId || ''),
    queryFn: () => shipComparisonService.getSimilarShips(shipId || '', limit),
    enabled: Boolean(shipId),
  });
}

export function useFleetCompositionAnalysis(fleetId: string | undefined) {
  return useQuery<FleetCompositionAnalysis>({
    queryKey: shipComparisonKeys.fleetAnalysis(fleetId || ''),
    queryFn: () => shipComparisonService.getFleetCompositionAnalysis(fleetId || ''),
    enabled: Boolean(fleetId),
  });
}
