/**
 * URL-backed filter state for the Personal Hangar page (Phase 3 pilot).
 *
 * All filters/pagination round-trip through URL search params.
 * Defaults match the previous `useState` initial values so behavior is unchanged
 * for users who navigate without query params.
 *
 * Add new filters here, never with a fresh `useState` — see
 * `.github/copilot-instructions.md` Frontend Conventions.
 */

import { z } from 'zod';

import { createSearchParamsParser } from '@/utils/searchParams';

const STATUS_VALUES = ['all', 'owned', 'pledged', 'loaned', 'gifted'] as const;
const CONDITION_VALUES = [
  'all',
  'pristine',
  'excellent',
  'good',
  'fair',
  'poor',
  'damaged',
  'critical',
] as const;
const SHARING_LEVEL_VALUES = [
  'all',
  'private',
  'personal',
  'shared_users',
  'organization',
  'alliance',
  'public',
] as const;
const PRODUCTION_STATUS_VALUES = [
  'all',
  'flight_ready',
  'in_concept',
  'in_production',
  'announced',
] as const;
const SORT_BY_VALUES = ['createdAt', 'shipName', 'status', 'condition', 'sharingLevel'] as const;

// Note: invalid values (e.g. ?status=garbage) cause `safeParse` to fail and
// `createSearchParamsParser` falls back to `schema.parse({})`, which fills in
// these `.default(...)` values. Missing keys go straight to the defaults.
export const personalHangarFiltersSchema = z.object({
  status: z.enum(STATUS_VALUES).default('all'),
  condition: z.enum(CONDITION_VALUES).default('all'),
  sharingLevel: z.enum(SHARING_LEVEL_VALUES).default('all'),
  productionStatus: z.enum(PRODUCTION_STATUS_VALUES).default('all'),
  sortBy: z.enum(SORT_BY_VALUES).default('createdAt'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  search: z.string().default(''),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export type PersonalHangarFilters = z.infer<typeof personalHangarFiltersSchema>;

export const PERSONAL_HANGAR_FILTER_DEFAULTS: PersonalHangarFilters = {
  status: 'all',
  condition: 'all',
  sharingLevel: 'all',
  productionStatus: 'all',
  sortBy: 'createdAt',
  sortOrder: 'DESC',
  search: '',
  page: 1,
  pageSize: 25,
};

export const parsePersonalHangarFilters = createSearchParamsParser(personalHangarFiltersSchema);

/**
 * Build the API query parameter shape from a parsed `PersonalHangarFilters`.
 *
 * Uses `filter[xxx]` format for filter params so the v2 queryParserMiddleware
 * populates `req.queryParams.filters` correctly. Sort is encoded as a signed
 * field name (`-shipName` = DESC, `shipName` = ASC) per queryParserMiddleware
 * convention.
 *
 * Used by both the page (for `useUserShips`) and the route loader (for
 * `queryClient.ensureQueryData`) so both produce the same React Query cache key.
 */
export function buildPersonalHangarQueryFilters(
  filters: PersonalHangarFilters
): Record<string, unknown> {
  const trimmedSearch = filters.search.trim();

  let sort: string | undefined;
  if (filters.sortBy !== 'createdAt' || filters.sortOrder !== 'DESC') {
    sort = filters.sortOrder === 'ASC' ? filters.sortBy : `-${filters.sortBy}`;
  }

  return {
    page: filters.page,
    limit: filters.pageSize,
    ...(filters.status !== 'all' && { 'filter[status]': filters.status }),
    ...(filters.condition !== 'all' && { 'filter[condition]': filters.condition }),
    ...(filters.sharingLevel !== 'all' && { 'filter[sharingLevel]': filters.sharingLevel }),
    ...(filters.productionStatus !== 'all' && {
      'filter[productionStatus]': filters.productionStatus,
    }),
    ...(trimmedSearch && { search: trimmedSearch }),
    ...(sort !== undefined && { sort }),
  };
}
