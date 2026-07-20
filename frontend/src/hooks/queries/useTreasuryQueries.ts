/**
 * Treasury Query Hooks
 *
 * TanStack Query hooks for treasury, dues, and commissary operations.
 */

import { treasuryService } from '@/services/treasuryService';
import type {
  CommissaryItem,
  CommissaryPurchase,
  CommissaryQueryParams,
  CreateCommissaryItemInput,
  CreateDuesInput,
  CreditPool,
  CreditTransaction,
  DuesQueryParams,
  EarnCreditsInput,
  LeaderboardEntry,
  OrgDues,
  PurchaseInput,
  PurchaseQueryParams,
  SpendCreditsInput,
  TransactionQueryParams,
  TransferCreditsInput,
  TreasuryPeriod,
  TreasuryStatistics,
  UpdateCommissaryItemInput,
  UpdateDuesInput,
} from '@/types/apiV2';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { treasuryKeys } from './queryKeys';

// ============================================================================
// Credit Pool Queries
// ============================================================================

export function useTreasuryBalance(
  options?: Omit<UseQueryOptions<CreditPool>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: treasuryKeys.balance(),
    queryFn: () => treasuryService.getBalance(),
    staleTime: 30_000,
    ...options,
  });
}

export function useTreasuryTransactions(
  params?: TransactionQueryParams,
  options?: Omit<
    UseQueryOptions<{ items: CreditTransaction[]; total: number }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: treasuryKeys.transactions(params as Record<string, unknown>),
    queryFn: () => treasuryService.getTransactions(params),
    ...options,
  });
}

export function useTreasuryStatistics(
  period?: TreasuryPeriod,
  options?: Omit<UseQueryOptions<TreasuryStatistics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: treasuryKeys.statistics(period),
    queryFn: () => treasuryService.getStatistics(period),
    ...options,
  });
}

export function useTreasuryLeaderboard(
  limit?: number,
  options?: Omit<UseQueryOptions<LeaderboardEntry[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: treasuryKeys.leaderboard(limit),
    queryFn: () => treasuryService.getLeaderboard(limit),
    staleTime: 5 * 60_000,
    ...options,
  });
}

// ============================================================================
// Credit Mutations
// ============================================================================

export function useEarnCredits() {  return useMutation({
    mutationFn: (data: EarnCreditsInput) => treasuryService.earnCredits(data),
    meta: { invalidates: [treasuryKeys.balance(), treasuryKeys.transactions(), treasuryKeys.statistics()] },
  });
}

export function useSpendCredits() {  return useMutation({
    mutationFn: (data: SpendCreditsInput) => treasuryService.spendCredits(data),
    meta: { invalidates: [treasuryKeys.balance(), treasuryKeys.transactions(), treasuryKeys.statistics()] },
  });
}

export function useTransferCredits() {  return useMutation({
    mutationFn: (data: TransferCreditsInput) => treasuryService.transferCredits(data),
    meta: { invalidates: [treasuryKeys.balance(), treasuryKeys.transactions(), treasuryKeys.statistics(), treasuryKeys.leaderboard()] },
  });
}

// ============================================================================
// Dues Queries & Mutations
// ============================================================================

export function useDues(
  params?: DuesQueryParams,
  options?: Omit<UseQueryOptions<OrgDues[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: treasuryKeys.dues(),
    queryFn: () => treasuryService.getDues(params),
    ...options,
  });
}

export function useCreateDues() {  return useMutation({
    mutationFn: (data: CreateDuesInput) => treasuryService.createDues(data),
    meta: { invalidates: [treasuryKeys.dues()] },
  });
}

export function useUpdateDues() {  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDuesInput }) =>
      treasuryService.updateDues(id, data),
    meta: { invalidates: [treasuryKeys.dues()] },
  });
}

export function useCollectDues() {  return useMutation({
    mutationFn: (id: string) => treasuryService.collectDues(id),
    meta: { invalidates: [treasuryKeys.dues(), treasuryKeys.balance(), treasuryKeys.transactions()] },
  });
}

// ============================================================================
// Commissary Queries & Mutations
// ============================================================================

export function useCommissaryItems(
  params?: CommissaryQueryParams,
  options?: Omit<UseQueryOptions<CommissaryItem[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: treasuryKeys.commissaryList(params as Record<string, unknown>),
    queryFn: () => treasuryService.getCommissaryItems(params),
    ...options,
  });
}

export function useCreateCommissaryItem() {  return useMutation({
    mutationFn: (data: CreateCommissaryItemInput) => treasuryService.createCommissaryItem(data),
    meta: { invalidates: [treasuryKeys.commissary()] },
  });
}

export function useUpdateCommissaryItem() {  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCommissaryItemInput }) =>
      treasuryService.updateCommissaryItem(id, data),
    meta: { invalidates: [treasuryKeys.commissary()] },
  });
}

export function useDeleteCommissaryItem() {  return useMutation({
    mutationFn: (id: string) => treasuryService.deleteCommissaryItem(id),
    meta: { invalidates: [treasuryKeys.commissary()] },
  });
}

export function usePurchaseItem() {  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PurchaseInput }) =>
      treasuryService.purchaseItem(id, data),
    meta: { invalidates: [treasuryKeys.commissary(), treasuryKeys.balance(), treasuryKeys.transactions(), treasuryKeys.purchases()] },
  });
}

export function usePurchaseHistory(
  params?: PurchaseQueryParams,
  options?: Omit<UseQueryOptions<CommissaryPurchase[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: treasuryKeys.purchases(params as Record<string, unknown>),
    queryFn: () => treasuryService.getPurchaseHistory(params),
    ...options,
  });
}
