/**
 * URL-backed filter state for the Organization Ships page.
 *
 * All filtering on this page is client-side (the org-ship query fetches up to
 * 500 ships in one go and `useFleet` derives the filtered fleet locally), so
 * there is no `build…QueryFilters` server-shape builder — the URL just owns
 * UI state for tabs, sub-tabs, search, role/size/ownership filters, and the
 * member-tab pagination.
 *
 * `role` and `size` are dynamic enums sourced from `useFleetStatistics`;
 * the schema therefore accepts any string (with `'all'` as the sentinel).
 *
 * See `.github/copilot-instructions.md` Frontend Conventions.
 */

import { z } from 'zod';

import { createSearchParamsParser } from '@/utils/searchParams';

const OWNERSHIP_VALUES = ['all', 'org', 'member'] as const;

export const organizationShipsFiltersSchema = z.object({
  tab: z.coerce.number().int().min(0).max(2).default(0),
  loansSubTab: z.coerce.number().int().min(0).max(2).default(0),
  role: z.string().default('all'),
  size: z.string().default('all'),
  ownership: z.enum(OWNERSHIP_VALUES).default('all'),
  /** Filter to ships belonging to a specific org fleet (fleet name, 'all' = no filter). */
  fleet: z.string().default('all'),
  /** Filter to ships owned/shared by a specific member (ownerName, 'all' = no filter). */
  memberOwner: z.string().default('all'),
  search: z.string().default(''),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  statsOpen: z.enum(['true', 'false']).default('true'),
});

export type OrganizationShipsFilters = z.infer<typeof organizationShipsFiltersSchema>;

export const ORGANIZATION_SHIPS_FILTER_DEFAULTS: OrganizationShipsFilters = {
  tab: 0,
  loansSubTab: 0,
  role: 'all',
  size: 'all',
  ownership: 'all',
  fleet: 'all',
  memberOwner: 'all',
  search: '',
  page: 1,
  pageSize: 25,
  statsOpen: 'true',
};

export const parseOrganizationShipsFilters = createSearchParamsParser(
  organizationShipsFiltersSchema
);
