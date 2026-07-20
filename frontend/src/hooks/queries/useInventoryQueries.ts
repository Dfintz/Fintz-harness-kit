/**
 * Inventory Query Hooks — Tech Debt Migration
 *
 * TanStack Query hooks for inventory/logistics operations with automatic caching,
 * background refetching, and cache invalidation.
 */

import { logisticsService } from '@/services/logisticsService';
import { selectUser, useAuthStore } from '@/store/authStore';
import type {
  CreateInventoryItemInput,
  InventoryItem,
  InventoryQueryParams,
  UpdateInventoryItemInput,
} from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { inventoryKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch inventory items with optional filters
 */
export function useInventory(
  params?: InventoryQueryParams,
  options?: Omit<UseQueryOptions<InventoryItem[]>, 'queryKey' | 'queryFn'>
) {
  const user = useAuthStore(selectUser);
  const hasOrg = !!(user?.organizationId || user?.activeOrgId);
  return useQuery({
    queryKey: inventoryKeys.list(params as Record<string, unknown>),
    queryFn: () => logisticsService.getInventory(params),
    enabled: hasOrg,
    ...options,
  });
}

/**
 * Hook to fetch a single inventory item by ID
 */
export function useInventoryItem(
  id: string | undefined,
  options?: Omit<UseQueryOptions<InventoryItem>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: inventoryKeys.detail(id!),
    queryFn: () => logisticsService.getInventoryItem(id!),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to fetch market prices for a specific item
 */
export function useMarketPrices(
  itemName: string | undefined,
  options?: Omit<
    UseQueryOptions<Awaited<ReturnType<typeof logisticsService.getMarketPrices>>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: inventoryKeys.marketPrices(itemName!),
    queryFn: () => logisticsService.getMarketPrices(itemName!),
    enabled: !!itemName,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new inventory item
 */
export function useCreateInventoryItem() {  return useMutation({
    mutationFn: (data: CreateInventoryItemInput) => logisticsService.createInventoryItem(data),
    meta: { invalidates: [inventoryKeys.lists()] },
  });
}

/**
 * Hook to update an existing inventory item
 */
export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemInput }) =>
      logisticsService.updateInventoryItem(id, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() });
    },
  });
}

/**
 * Hook to delete an inventory item
 */
export function useDeleteInventoryItem() {  return useMutation({
    mutationFn: (id: string) => logisticsService.deleteInventoryItem(id),
    meta: { invalidates: [inventoryKeys.lists()] },
  });
}

/**
 * Hook to update prices for a single item
 */
export function useUpdateItemPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      marketData,
    }: {
      id: string;
      marketData: { avgBuyPrice?: number; avgSellPrice?: number };
    }) => logisticsService.updateItemPrices(id, marketData),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() });
    },
  });
}

/**
 * Hook to bulk-update all item prices
 */
export function useUpdateAllPrices() {  return useMutation({
    mutationFn: (items: InventoryItem[]) => logisticsService.updateAllPrices(items),
    meta: { invalidates: [inventoryKeys.all] },
  });
}
