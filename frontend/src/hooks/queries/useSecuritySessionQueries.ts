/**
 * Security Session Query Hooks
 *
 * TanStack Query hooks for security settings: sessions, trusted devices, and access logs.
 *
 * Created in Sprint 7 — Security Settings Completion
 */

import type {
  AccountAccessLog,
  RevokeTrustedDeviceRequest,
  TrustedDevice,
  UserLoginSession,
} from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery } from '@tanstack/react-query';

import { securitySessionService } from '@/services/securitySessionService';
import { securitySessionKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get active sessions for the current user
 */
export function useSessions() {
  return useQuery<UserLoginSession[]>({
    queryKey: securitySessionKeys.sessions(),
    queryFn: () => securitySessionService.getSessions(),
  });
}

/**
 * Hook to get trusted devices for the current user
 */
export function useTrustedDevices() {
  return useQuery<TrustedDevice[]>({
    queryKey: securitySessionKeys.trustedDevices(),
    queryFn: () => securitySessionService.getTrustedDevices(),
  });
}

/**
 * Hook to get access logs for the current user
 */
export function useAccessLogs(limit = 50, offset = 0) {
  return useQuery<AccountAccessLog[]>({
    queryKey: securitySessionKeys.accessLogs({ limit, offset }),
    queryFn: () => securitySessionService.getAccessLog(limit, offset),
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to revoke a specific session
 */
export function useRevokeSession() {  return useMutation({
    mutationFn: (sessionId: number | string) => securitySessionService.revokeSession(sessionId),
    meta: { invalidates: [securitySessionKeys.sessions()] },
  });
}

/**
 * Hook to revoke a trusted device
 */
export function useRevokeTrustedDevice() {  return useMutation({
    mutationFn: (payload: RevokeTrustedDeviceRequest) =>
      securitySessionService.revokeTrustedDevice(payload),
    meta: { invalidates: [securitySessionKeys.trustedDevices()] },
  });
}
