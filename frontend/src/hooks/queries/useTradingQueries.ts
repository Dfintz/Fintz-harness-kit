/**
 * Trading Query Hooks — Phase 3
 *
 * TanStack Query hooks for trading route operations with automatic caching,
 * background refetching, and optimistic updates.
 */

import type {
  CreatePriceAlertInput,
  PriceAlert,
  UEXCommodityInfo,
  UEXRouteSearchParams,
  UEXRoutesResponse,
  UEXTerminalInfo,
  UpdatePriceAlertInput,
} from '@/services/tradingServiceV2';
import { tradingServiceV2 } from '@/services/tradingServiceV2';
import type {
  MarketAnalysis,
  MarketAnalysisParams,
  PaginatedResult,
  TradingAnalytics,
  TradingOpportunities,
  TradingOpportunityParams,
  TradingRouteListParams,
  TradingRouteV2,
} from '@/types/apiV2';
import { RouteStatus } from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { tradingKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch paginated trading routes for an organization
 */
export function useTradingRoutes(
  orgId: string | undefined,
  params?: TradingRouteListParams,
  options?: Omit<UseQueryOptions<PaginatedResult<TradingRouteV2>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: tradingKeys.routes(),
    queryFn: () => tradingServiceV2.getRoutes(orgId!, params),
    enabled: !!orgId,
    ...options,
  });
}

/**
 * Hook to fetch a single trading route by ID
 */
export function useTradingRoute(
  routeId: string | undefined,
  options?: Omit<UseQueryOptions<TradingRouteV2>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: tradingKeys.route(routeId!),
    queryFn: () => tradingServiceV2.getRouteById(routeId!),
    enabled: !!routeId,
    ...options,
  });
}

/**
 * Hook to fetch trading analytics for an organization
 */
export function useTradingAnalytics(
  orgId: string | undefined,
  options?: Omit<UseQueryOptions<TradingAnalytics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...tradingKeys.all, 'analytics', orgId] as const,
    queryFn: () => tradingServiceV2.getAnalytics(orgId!),
    enabled: !!orgId,
    ...options,
  });
}

/**
 * Hook to fetch trading opportunities
 */
export function useTradingOpportunities(
  params?: TradingOpportunityParams,
  options?: Omit<UseQueryOptions<TradingOpportunities>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...tradingKeys.all, 'opportunities', params] as const,
    queryFn: () => tradingServiceV2.getOpportunities(params),
    ...options,
  });
}

/**
 * Hook to fetch market analysis
 */
export function useMarketAnalysis(
  params?: MarketAnalysisParams,
  options?: Omit<UseQueryOptions<MarketAnalysis>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...tradingKeys.all, 'market-analysis', params] as const,
    queryFn: () => tradingServiceV2.getMarketAnalysis(params),
    ...options,
  });
}

/**
 * Hook to fetch trading commodity prices
 */
export function useTradingPrices(options?: Omit<UseQueryOptions<unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: tradingKeys.prices(),
    queryFn: () => tradingServiceV2.getMarketAnalysis(),
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new trading route
 */
export function useCreateTradingRoute(orgId: string) {
  return useMutation({
    mutationFn: (data: Parameters<typeof tradingServiceV2.createRoute>[1]) =>
      tradingServiceV2.createRoute(orgId, data),
    meta: { invalidates: [tradingKeys.routes(), [...tradingKeys.all, 'analytics', orgId]] },
  });
}

/**
 * Hook to update an existing trading route
 */
export function useUpdateTradingRoute(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      routeId,
      data,
    }: {
      routeId: string;
      data: Parameters<typeof tradingServiceV2.updateRoute>[1];
    }) => tradingServiceV2.updateRoute(routeId, data),
    onSuccess: (_result, { routeId }) => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.route(routeId) });
      queryClient.invalidateQueries({ queryKey: tradingKeys.routes() });
      queryClient.invalidateQueries({
        queryKey: [...tradingKeys.all, 'analytics', orgId],
      });
    },
  });
}

/**
 * Hook to delete a trading route
 */
export function useDeleteTradingRoute(orgId: string) {
  return useMutation({
    mutationFn: (routeId: string) => tradingServiceV2.deleteRoute(routeId),
    meta: { invalidates: [tradingKeys.routes(), [...tradingKeys.all, 'analytics', orgId]] },
  });
}

/**
 * Hook to update a route's status (activate/deactivate/deprecate)
 */
export function useUpdateRouteStatus(_orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routeId, status }: { routeId: string; status: RouteStatus }) =>
      tradingServiceV2.updateRouteStatus(routeId, status),
    onSuccess: (_result, { routeId }) => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.route(routeId) });
      queryClient.invalidateQueries({ queryKey: tradingKeys.routes() });
    },
  });
}

// ============================================================================
// Price Alert Query Hooks
// ============================================================================

/**
 * Hook to fetch all price alerts for the current user
 */
export function usePriceAlerts(
  options?: Omit<UseQueryOptions<PriceAlert[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: tradingKeys.alerts(),
    queryFn: () => tradingServiceV2.getPriceAlerts(),
    ...options,
  });
}

/**
 * Hook to create a new price alert
 */
export function useCreatePriceAlert() {
  return useMutation({
    mutationFn: (data: CreatePriceAlertInput) => tradingServiceV2.createPriceAlert(data),
    meta: { invalidates: [tradingKeys.alerts()] },
  });
}

/**
 * Hook to update a price alert
 */
export function useUpdatePriceAlert() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePriceAlertInput }) =>
      tradingServiceV2.updatePriceAlert(id, data),
    meta: { invalidates: [tradingKeys.alerts()] },
  });
}

/**
 * Hook to delete a price alert
 */
export function useDeletePriceAlert() {
  return useMutation({
    mutationFn: (id: string) => tradingServiceV2.deletePriceAlert(id),
    meta: { invalidates: [tradingKeys.alerts()] },
  });
}

// ============================================================================
// UEX Route Suggestions
// ============================================================================

/**
 * Hook to fetch suggested trade routes from UEX Corp data
 */
export function useUexRoutes(
  orgId: string | undefined,
  params?: UEXRouteSearchParams,
  options?: Omit<UseQueryOptions<UEXRoutesResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: tradingKeys.uexRoutes(params as Record<string, unknown> | undefined),
    queryFn: () => tradingServiceV2.getUexRoutes(orgId!, params),
    enabled: !!orgId,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook to fetch UEX terminals for dropdown population
 */
export function useUexTerminals(
  orgId: string | undefined,
  options?: Omit<UseQueryOptions<UEXTerminalInfo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...tradingKeys.all, 'uex-terminals'] as const,
    queryFn: () => tradingServiceV2.getUexTerminals(orgId!),
    enabled: !!orgId,
    staleTime: 60 * 60 * 1000, // Terminals rarely change — 1 hour
    ...options,
  });
}

/**
 * Hook to fetch UEX commodities for dropdown population
 */
export function useUexCommodities(
  orgId: string | undefined,
  options?: Omit<UseQueryOptions<UEXCommodityInfo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...tradingKeys.all, 'uex-commodities'] as const,
    queryFn: () => tradingServiceV2.getUexCommodities(orgId!),
    enabled: !!orgId,
    staleTime: 60 * 60 * 1000, // Commodities rarely change — 1 hour
    ...options,
  });
}
