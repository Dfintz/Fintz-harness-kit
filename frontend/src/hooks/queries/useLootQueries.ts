/**
 * Loot Distribution Query Hooks
 *
 * TanStack Query hooks for the commissary loot distribution feature.
 */

import {
  type ClaimInput,
  type CreateLootPoolInput,
  type EligibleParticipant,
  type LootItemInput,
  lootService,
  type LootPoolQueryParams,
  type UpdateLootPoolInput,
} from '@/services/lootService';
import type { LootPool, LootPoolDetail } from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { lootKeys } from './queryKeys';

// ==================== Queries ====================

export function useLootPools(
  params?: LootPoolQueryParams,
  options?: Omit<UseQueryOptions<LootPool[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: lootKeys.pools(params as Record<string, unknown>),
    queryFn: () => lootService.listPools(params),
    ...options,
  });
}

export function useLootPool(
  poolId: string,
  options?: Omit<UseQueryOptions<LootPoolDetail>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: lootKeys.pool(poolId),
    queryFn: () => lootService.getPool(poolId),
    enabled: Boolean(poolId),
    ...options,
  });
}

export function useLootEligibleParticipants(
  poolId: string,
  options?: Omit<UseQueryOptions<EligibleParticipant[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: lootKeys.participants(poolId),
    queryFn: () => lootService.getEligibleParticipants(poolId),
    enabled: Boolean(poolId),
    ...options,
  });
}

// ==================== Pool mutations ====================

export function useCreateLootPool() {
  return useMutation({
    mutationFn: (data: CreateLootPoolInput) => lootService.createPool(data),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useUpdateLootPool() {
  return useMutation({
    mutationFn: ({ poolId, data }: { poolId: string; data: UpdateLootPoolInput }) =>
      lootService.updatePool(poolId, data),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useLockLootPool() {
  return useMutation({
    mutationFn: (poolId: string) => lootService.lockPool(poolId),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useCancelLootPool() {
  return useMutation({
    mutationFn: (poolId: string) => lootService.cancelPool(poolId),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useDistributeLootPool() {
  return useMutation({
    mutationFn: (poolId: string) => lootService.distributePool(poolId),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useRetryLootDistribution() {
  return useMutation({
    mutationFn: (poolId: string) => lootService.retryDistribution(poolId),
    meta: { invalidates: [lootKeys.all] },
  });
}

// ==================== Item mutations ====================

export function useAddLootItem() {
  return useMutation({
    mutationFn: ({ poolId, data }: { poolId: string; data: LootItemInput }) =>
      lootService.addItem(poolId, data),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useAddLootItemsBulk() {
  return useMutation({
    mutationFn: ({ poolId, items }: { poolId: string; items: LootItemInput[] }) =>
      lootService.addItemsBulk(poolId, items),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useUpdateLootItem() {
  return useMutation({
    mutationFn: ({
      poolId,
      itemId,
      data,
    }: {
      poolId: string;
      itemId: string;
      data: Partial<LootItemInput>;
    }) => lootService.updateItem(poolId, itemId, data),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useRemoveLootItem() {
  return useMutation({
    mutationFn: ({ poolId, itemId }: { poolId: string; itemId: string }) =>
      lootService.removeItem(poolId, itemId),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useAssignLootItem() {
  return useMutation({
    mutationFn: ({ poolId, itemId, userId }: { poolId: string; itemId: string; userId: string }) =>
      lootService.assignItem(poolId, itemId, userId),
    meta: { invalidates: [lootKeys.all] },
  });
}

// ==================== Claim mutations ====================

export function useClaimLootItem() {
  return useMutation({
    mutationFn: ({ poolId, itemId, data }: { poolId: string; itemId: string; data: ClaimInput }) =>
      lootService.claimItem(poolId, itemId, data),
    meta: { invalidates: [lootKeys.all] },
  });
}

export function useWithdrawLootClaim() {
  return useMutation({
    mutationFn: ({ poolId, itemId }: { poolId: string; itemId: string }) =>
      lootService.withdrawClaim(poolId, itemId),
    meta: { invalidates: [lootKeys.all] },
  });
}

// ==================== OCR ====================

export function useScanLootImage() {
  return useMutation({
    mutationFn: (file: File) => lootService.scanImage(file),
  });
}

export function useScanLootPoolImage() {
  return useMutation({
    mutationFn: ({ poolId, file }: { poolId: string; file: File }) =>
      lootService.scanPoolImage(poolId, file),
  });
}
