/**
 * URL-backed filter state for the Public Directory page (`/directory`).
 *
 * The directory has four tabs (organizations, alliances, opportunities,
 * members). The active tab is already URL-synced via the `tab` search
 * param by the page component itself — we do NOT manage it here.
 *
 * Multi-select filters (`focuses`, `activityLevels`) are stored as
 * comma-separated strings in the URL because `useUrlFilters` only
 * persists primitive values; the build helpers split them back into
 * arrays for the API call.
 *
 * See `.github/copilot-instructions.md` Frontend Conventions.
 */

import { z } from 'zod';

import type {
  ActivityLevel,
  DirectoryFilters,
  OrgPrimaryFocus,
  PaginationOptions,
} from '@/services/publicDirectoryService';
import { createSearchParamsParser } from '@/utils/searchParams';

const ORG_FOCUS_VALUES: ReadonlyArray<OrgPrimaryFocus> = [
  'combat',
  'mining',
  'trading',
  'exploration',
  'bounty_hunting',
  'medical',
  'transport',
  'salvage',
  'security',
  'social',
  'piracy',
  'racing',
  'mixed',
];
const ACTIVITY_VALUES: ReadonlyArray<ActivityLevel> = [
  'inactive',
  'low',
  'moderate',
  'high',
  'very_high',
];

const SORT_BY_VALUES = ['memberCount', 'createdAt', 'updatedAt', 'name'] as const;
const SORT_ORDER_VALUES = ['ASC', 'DESC'] as const;
const TRISTATE_VALUES = ['all', 'true', 'false'] as const;

export const directoryOrganizationsFiltersSchema = z.object({
  search: z.string().default(''),
  focuses: z.string().default(''),
  activityLevels: z.string().default(''),
  minMembers: z.coerce.number().int().nonnegative().default(0),
  maxMembers: z.coerce.number().int().nonnegative().default(0),
  isRecruiting: z.enum(TRISTATE_VALUES).default('all'),
  isVerified: z.enum(TRISTATE_VALUES).default('all'),
  sortBy: z.enum(SORT_BY_VALUES).default('memberCount'),
  sortOrder: z.enum(SORT_ORDER_VALUES).default('DESC'),
  page: z.coerce.number().int().positive().default(1),
});

export type DirectoryOrganizationsFilters = z.infer<typeof directoryOrganizationsFiltersSchema>;

export const DIRECTORY_ORGANIZATIONS_FILTER_DEFAULTS: DirectoryOrganizationsFilters = {
  search: '',
  focuses: '',
  activityLevels: '',
  minMembers: 0,
  maxMembers: 0,
  isRecruiting: 'all',
  isVerified: 'all',
  sortBy: 'memberCount',
  sortOrder: 'DESC',
  page: 1,
};

export const parseDirectoryOrganizationsFilters = createSearchParamsParser(
  directoryOrganizationsFiltersSchema
);

function splitCsv<T extends string>(csv: string, allowed: ReadonlyArray<T>): T[] {
  if (!csv) return [];
  const allowedSet = new Set<string>(allowed);
  return csv
    .split(',')
    .map(s => s.trim())
    .filter((s): s is T => allowedSet.has(s));
}

/** Parsed (array) view of the multi-select filters, derived from the URL string form. */
export function parseDirectoryFocuses(focuses: string): OrgPrimaryFocus[] {
  return splitCsv(focuses, ORG_FOCUS_VALUES);
}

export function parseDirectoryActivityLevels(activityLevels: string): ActivityLevel[] {
  return splitCsv(activityLevels, ACTIVITY_VALUES);
}

/**
 * Build the API filter shape consumed by `publicDirectoryService.getDirectory`.
 * Drops sentinels (`'all'`, `0`, empty string) so the server only sees the
 * user's actual selections.
 */
export function buildDirectoryQueryFilters(
  filters: DirectoryOrganizationsFilters
): DirectoryFilters {
  const out: DirectoryFilters = {};
  const trimmedSearch = filters.search.trim();
  if (trimmedSearch) out.search = trimmedSearch;

  const focuses = parseDirectoryFocuses(filters.focuses);
  if (focuses.length > 0) out.primaryFocuses = focuses;

  const activityLevels = parseDirectoryActivityLevels(filters.activityLevels);
  if (activityLevels.length > 0) out.activityLevels = activityLevels;

  if (filters.minMembers > 0) out.minMemberCount = filters.minMembers;
  if (filters.maxMembers > 0) out.maxMemberCount = filters.maxMembers;
  if (filters.isRecruiting !== 'all') out.isRecruiting = filters.isRecruiting === 'true';
  if (filters.isVerified !== 'all') out.isVerified = filters.isVerified === 'true';
  return out;
}

/**
 * Build the pagination/sort shape consumed by
 * `publicDirectoryService.getDirectory`.
 */
export function buildDirectoryPagination(
  filters: DirectoryOrganizationsFilters,
  limit: number
): PaginationOptions {
  return {
    page: filters.page,
    limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };
}
