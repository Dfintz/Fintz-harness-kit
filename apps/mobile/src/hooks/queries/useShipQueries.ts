/**
 * Ship Query Hooks for Mobile
 * TanStack Query hooks for ship operations.
 * Ported from frontend/src/hooks/queries/useShipQueries.ts
 */

import { shipServiceV2 } from '@/services/shipServiceV2';
import type { PaginatedResult, PaginationParams, ShipV2 } from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { fleetKeys, shipKeys } from './queryKeys';

export function useShips(
  params?: PaginationParams,
  options?: Omit<UseQueryOptions<PaginatedResult<ShipV2>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shipKeys.list(params as Record<string, unknown>),
    queryFn: () => shipServiceV2.getShips(params),
    ...options,
  });
}

export function useSearchShips(
  searchTerm: string,
  params?: PaginationParams,
  options?: Omit<UseQueryOptions<PaginatedResult<ShipV2>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...shipKeys.lists(), 'search', { searchTerm, ...params }],
    queryFn: () => shipServiceV2.searchShips(searchTerm, params),
    enabled: searchTerm.length > 0,
    ...options,
  });
}

export function useShip(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ShipV2>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: shipKeys.detail(id!),
    queryFn: () => shipServiceV2.getShipById(id!),
    enabled: !!id,
    ...options,
  });
}

// Mutations

interface CreateShipInput {
  name: string;
  manufacturer: string;
  model: string;
  role: string;
  size: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
}

interface UpdateShipInput {
  id: string;
  data: {
    name?: string;
    manufacturer?: string;
    model?: string;
    role?: string;
    size?: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
  };
}

export function useCreateShip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateShipInput) => shipServiceV2.createShip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shipKeys.lists() });
      queryClient.invalidateQueries({ queryKey: fleetKeys.lists() });
    },
  });
}

export function useUpdateShip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: UpdateShipInput) => shipServiceV2.updateShip(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: shipKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: shipKeys.lists() });
    },
  });
}

export function useDeleteShip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shipServiceV2.deleteShip(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: shipKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: shipKeys.lists() });
      queryClient.invalidateQueries({ queryKey: fleetKeys.lists() });
    },
  });
}
