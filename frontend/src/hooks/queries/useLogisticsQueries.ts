/**
 * Logistics / Inventory Query Hooks — Sprint 22-C React Query Migration
 *
 * TanStack Query hooks for logistics and inventory management with automatic
 * caching, background refetching, and cache invalidation.
 */

import { logisticsService } from '@/services/logisticsService';
import { selectUser, useAuthStore } from '@/store/authStore';
import type {
  CreateInventoryItemInput,
  InventoryAdjustment,
  InventoryItem,
  InventoryQueryParams,
  InventoryStatistics,
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
    queryKey: inventoryKeys.detail(id ?? ''),
    queryFn: () => logisticsService.getInventoryItem(id as string),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to search inventory by query and optional category
 */
export function useInventorySearch(
  query: string,
  category?: string,
  options?: Omit<UseQueryOptions<InventoryItem[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: inventoryKeys.list({ search: query, category }),
    queryFn: () => logisticsService.searchInventory(query, category),
    enabled: query.length > 0,
    ...options,
  });
}

/**
 * Hook to fetch inventory statistics (global or per-fleet)
 */
export function useInventoryStatistics(
  fleetId?: string,
  options?: Omit<UseQueryOptions<InventoryStatistics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: inventoryKeys.statistics(fleetId),
    queryFn: () => logisticsService.getInventoryStatistics(fleetId),
    ...options,
  });
}

/**
 * Hook to fetch inventory grouped by category
 */
export function useInventoryByCategory(
  fleetId?: string,
  options?: Omit<UseQueryOptions<Record<string, InventoryItem[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: inventoryKeys.byCategory(fleetId),
    queryFn: () => logisticsService.getInventoryByCategory(fleetId),
    ...options,
  });
}

/**
 * Hook to fetch low stock report
 */
export function useLowStockReport(
  fleetId?: string,
  options?: Omit<UseQueryOptions<InventoryItem[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: inventoryKeys.lowStock(fleetId),
    queryFn: () => logisticsService.getLowStockReport(fleetId),
    ...options,
  });
}

/**
 * Hook to fetch market prices for an item
 */
export function useMarketPrices(
  itemName: string | undefined,
  options?: Omit<
    UseQueryOptions<Awaited<ReturnType<typeof logisticsService.getMarketPrices>>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: inventoryKeys.marketPrices(itemName ?? ''),
    queryFn: () => logisticsService.getMarketPrices(itemName as string),
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
    meta: { invalidates: [inventoryKeys.lists(), inventoryKeys.all] },
  });
}

/**
 * Hook to update an inventory item
 */
export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemInput }) =>
      logisticsService.updateInventoryItem(id, data),
    onSuccess: (_, { id }) => {
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
    meta: { invalidates: [inventoryKeys.all] },
  });
}

/**
 * Hook to adjust inventory stock
 */
export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, adjustment }: { id: string; adjustment: InventoryAdjustment }) =>
      logisticsService.adjustStock(id, adjustment),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

/**
 * Hook to update market prices for an item
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
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(id) });
    },
  });
}

/**
 * Hook to bulk update all item prices
 */
export function useUpdateAllPrices() {  return useMutation({
    mutationFn: (items: InventoryItem[]) => logisticsService.updateAllPrices(items),
    meta: { invalidates: [inventoryKeys.all] },
  });
}
