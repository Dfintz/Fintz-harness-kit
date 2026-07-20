import { useQuery } from '@tanstack/react-query';

import {
  auditService,
  type AuditLogEntry,
  type AuditLogFilters,
  type AuditStatistics,
} from '@/services/auditService';

import { auditKeys } from './queryKeys';

export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery<AuditLogEntry[]>({
    queryKey: auditKeys.logs(filters as Record<string, unknown>),
    queryFn: () => auditService.getLogs(filters),
  });
}

export function useAuditLogDetail(logId: string | undefined) {
  return useQuery<AuditLogEntry>({
    queryKey: auditKeys.log(logId!),
    queryFn: () => auditService.getLogById(logId!),
    enabled: !!logId,
  });
}

export function useAuditStatistics(orgId?: string) {
  return useQuery<AuditStatistics>({
    queryKey: auditKeys.statistics(orgId),
    queryFn: () => auditService.getStatistics(orgId),
  });
}
