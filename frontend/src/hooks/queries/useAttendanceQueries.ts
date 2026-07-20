/**
 * Attendance React Query Hooks
 *
 * TanStack React Query hooks for the attendance subsystem.
 * Covers activity stats, reports, user history, leaderboard,
 * and mutation hooks for confirming and marking no-shows.
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { attendanceKeys } from './queryKeys';
import {
  attendanceService,
  type AttendanceReport,
  type AttendanceStats,
  type LeaderboardEntry,
  type UserAttendanceHistory,
} from '@/services/attendanceService';

// Re-export types for consumers
export type { AttendanceReport, AttendanceStats, LeaderboardEntry, UserAttendanceHistory };
export type { AttendanceStatus, AttendanceReportAttendee } from '@/services/attendanceService';

// ============================================================================
// Queries
// ============================================================================

export function useActivityAttendanceStats(activityId: string | undefined) {
  return useQuery<AttendanceStats>({
    queryKey: attendanceKeys.activityStats(activityId ?? ''),
    queryFn: () => attendanceService.getActivityStats(activityId!),
    enabled: !!activityId,
  });
}

export function useActivityAttendanceReport(activityId: string | undefined) {
  return useQuery<AttendanceReport>({
    queryKey: attendanceKeys.activityReport(activityId ?? ''),
    queryFn: () => attendanceService.getActivityReport(activityId!),
    enabled: !!activityId,
  });
}

export function useUserAttendanceHistory(
  userId: string | undefined,
  params?: { monthsBack?: number }
) {
  return useQuery<UserAttendanceHistory>({
    queryKey: attendanceKeys.userHistory(userId ?? '', params),
    queryFn: () => attendanceService.getUserHistory(userId!, params),
    enabled: !!userId,
  });
}

export function useAttendanceLeaderboard(
  organizationId: string | undefined,
  params?: { monthsBack?: number; limit?: number }
) {
  return useQuery<LeaderboardEntry[]>({
    queryKey: attendanceKeys.leaderboard(organizationId ?? '', params),
    queryFn: () => attendanceService.getLeaderboard(organizationId!, params),
    enabled: !!organizationId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useConfirmAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      activityId,
      data,
    }: {
      activityId: string;
      data: { userId?: string; notes?: string };
    }) => attendanceService.confirmAttendance(activityId, data),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.activityStats(activityId) });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.activityReport(activityId) });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useMarkNoShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      activityId,
      data,
    }: {
      activityId: string;
      data: { userId: string; isExcused?: boolean; reason?: string };
    }) => attendanceService.markNoShow(activityId, data),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.activityStats(activityId) });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.activityReport(activityId) });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}
