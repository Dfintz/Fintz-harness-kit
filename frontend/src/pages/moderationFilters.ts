/**
 * URL-backed filter state for the Moderation page (Incidents tab).
 *
 * The Moderation page has multiple tabs (incidents, analytics, repeat
 * offenders, lookup, sharing). Only the incidents-tab list is filterable, so
 * only its filters live in the URL. The active tab is intentionally NOT
 * URL-backed (the existing in-page tab state is preserved).
 *
 * Mirrors `IncidentSearchFilters` from `@/services/moderationService` — the
 * `build…QueryFilters` function produces the exact server shape that
 * `useIncidents` consumes so cache keys match between the loader and the
 * hook.
 *
 * See `.github/copilot-instructions.md` Frontend Conventions.
 */

import { z } from 'zod';

import type { IncidentSearchFilters } from '@/services/moderationService';
import { createSearchParamsParser } from '@/utils/searchParams';

const INCIDENT_TYPE_VALUES = ['all', 'WARNING', 'TIMEOUT', 'LONG_TIMEOUT', 'KICK', 'BAN'] as const;

const INCIDENT_STATUS_VALUES = ['all', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const;

export const moderationFiltersSchema = z.object({
  incidentType: z.enum(INCIDENT_TYPE_VALUES).default('all'),
  status: z.enum(INCIDENT_STATUS_VALUES).default('all'),
  search: z.string().default(''),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(12),
});

export type ModerationFilters = z.infer<typeof moderationFiltersSchema>;

export const MODERATION_FILTER_DEFAULTS: ModerationFilters = {
  incidentType: 'all',
  status: 'all',
  search: '',
  page: 1,
  pageSize: 12,
};

export const parseModerationFilters = createSearchParamsParser(moderationFiltersSchema);

/**
 * Build the API query parameter shape consumed by `useIncidents` /
 * `moderationService.searchIncidents`. Drops the `'all'` sentinels and
 * trims `search` so the server only sees the user's actual selections.
 */
export function buildModerationQueryFilters(filters: ModerationFilters): IncidentSearchFilters {
  const trimmedSearch = filters.search.trim();
  const out: IncidentSearchFilters = {
    page: filters.page,
    limit: filters.pageSize,
  };
  if (filters.incidentType !== 'all') out.incidentType = filters.incidentType;
  if (filters.status !== 'all') out.status = filters.status;
  if (trimmedSearch) out.searchTerm = trimmedSearch;
  return out;
}
