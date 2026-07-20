/**
 * API Key Query Hooks
 *
 * TanStack Query hooks for managing user API keys.
 */

import {
    apiKeyService,
    type ApiKeyInfo
} from '@/services/apiKeyService';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';

const apiKeyKeys = {
  all: ['apiKeys'] as const,
  list: () => [...apiKeyKeys.all, 'list'] as const,
  detail: (id: string) => [...apiKeyKeys.all, 'detail', id] as const,
};

/**
 * Hook to list all API keys for the current user
 */
export function useApiKeys(
  options?: Omit<UseQueryOptions<ApiKeyInfo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: apiKeyKeys.list(),
    queryFn: () => apiKeyService.listKeys(),
    ...options,
  });
}

/**
 * Hook to create a new API key
 */
export function useCreateApiKey() {  return useMutation({
    mutationFn: (data: { name: string; scopes: string[]; expiresInDays?: number }) =>
      apiKeyService.createKey(data),
    meta: { invalidates: [apiKeyKeys.list()] },
  });
}

/**
 * Hook to update an API key
 */
export function useUpdateApiKey() {  return useMutation({
    mutationFn: ({
      keyId,
      data,
    }: {
      keyId: string;
      data: { name?: string; scopes?: string[] };
    }) => apiKeyService.updateKey(keyId, data),
    meta: { invalidates: [apiKeyKeys.list()] },
  });
}

/**
 * Hook to revoke an API key
 */
export function useRevokeApiKey() {  return useMutation({
    mutationFn: ({ keyId }: { keyId: string }) => apiKeyService.revokeKey(keyId),
    meta: { invalidates: [apiKeyKeys.list()] },
  });
}
