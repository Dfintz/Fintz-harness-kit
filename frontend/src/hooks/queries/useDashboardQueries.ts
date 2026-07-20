/**
 * Dashboard Query Hooks (Sprint 0 — D2)
 *
 * TanStack Query hook for the unified dashboard summary endpoint.
 * Replaces the 3+ separate API calls in Dashboard.tsx (overview, feed,
 * myOrganizations) with a single `GET /api/v2/dashboard/summary` call.
 */

import { activityServiceV2 } from '@/services/activityServiceV2';
import { apiClient } from '@/services/apiClient';
import { extractData } from '@/services/baseService';
import { userShipService } from '@/services/userShipService';
import type { DashboardSummaryResponse } from '@/types/apiV2';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { dashboardKeys } from './queryKeys';

/**
 * Fetch the unified dashboard summary from the backend.
 */
async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const response = await apiClient.get<DashboardSummaryResponse>('/api/v2/dashboard/summary');
  return extractData(response);
}

/**
 * Hook: unified dashboard summary.
 *
 * An authenticated user gets either:
 *   • Full org dashboard (fleets, activities, teams, members, scStats) — if
 *     they belong to an active organization.
 *   • Reduced payload (only notifications) — if they are a solo user.
 *
 * `staleTime` defaults to 30 s so the dashboard does not bombard the server
 * on rapid navigation.
 */
export function useDashboardSummary(
  options?: Omit<UseQueryOptions<DashboardSummaryResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: fetchDashboardSummary,
    staleTime: 30_000,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Personal dashboard data (ships + upcoming activities) — solo users only
// ---------------------------------------------------------------------------

interface PersonalDashboardData {
  ships: unknown[];
  activities: unknown[];
}

async function fetchPersonalData(): Promise<PersonalDashboardData> {
  const [shipsData, activitiesData] = await Promise.all([
    userShipService.getUserShips({ limit: 20 }),
    activityServiceV2.getUpcomingActivities({ limit: 10 }),
  ]);
  // userShipService.getUserShips returns { data: [...], pagination: {...} }
  const shipEnvelope = shipsData as unknown as Record<string, unknown>;
  let shipArray: unknown[] = [];
  if (Array.isArray(shipEnvelope.data)) {
    shipArray = shipEnvelope.data;
  } else if (Array.isArray(shipsData)) {
    shipArray = shipsData as unknown[];
  }

  // activityServiceV2.getUpcomingActivities returns { activities: [...], count: N }
  const actEnvelope = activitiesData as unknown as Record<string, unknown>;
  let actArray: unknown[] = [];
  if (Array.isArray(actEnvelope.activities)) {
    actArray = actEnvelope.activities;
  } else if (Array.isArray(activitiesData)) {
    actArray = activitiesData as unknown[];
  }

  return {
    ships: shipArray,
    activities: actArray,
  };
}

/**
 * Hook: personal dashboard data (ships + upcoming activities).
 * Only enabled for users without an active organization.
 */
export function usePersonalDashboardData(
  enabled: boolean,
  options?: Omit<UseQueryOptions<PersonalDashboardData>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: dashboardKeys.personalData(),
    queryFn: fetchPersonalData,
    staleTime: 30_000,
    enabled,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Member activity stats
// ---------------------------------------------------------------------------

export interface MemberActivityStats {
  totalActivities: number;
  loginCount: number;
  recentActivity: Date | null;
}

async function fetchMemberActivityStats(): Promise<MemberActivityStats | null> {
  const response = await apiClient.get<MemberActivityStats>('/api/v2/users/me/activity/timeline');
  return extractData(response);
}

/**
 * Hook: member activity stats (login count, total activities, recent activity).
 */
export function useMemberActivityStats(
  userId: string | undefined,
  options?: Omit<UseQueryOptions<MemberActivityStats | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: dashboardKeys.memberActivity(userId ?? ''),
    queryFn: fetchMemberActivityStats,
    staleTime: 60_000,
    enabled: !!userId,
    ...options,
  });
}
