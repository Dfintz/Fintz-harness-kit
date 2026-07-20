/**
 * URL-backed filter state for the Legal Hold Management admin component.
 *
 * The list is fetched in one call from `/api/v2/admin/legal-holds` and
 * filtered entirely client-side, so there is no `build…QueryFilters` server
 * shape — the URL just owns the search box and status dropdown.
 *
 * See `.github/copilot-instructions.md` Frontend Conventions.
 */

import { z } from 'zod';

import { createSearchParamsParser } from '@/utils/searchParams';

const STATUS_VALUES = ['all', 'active', 'inactive'] as const;

export const legalHoldFiltersSchema = z.object({
  search: z.string().default(''),
  status: z.enum(STATUS_VALUES).default('all'),
});

export type LegalHoldFilters = z.infer<typeof legalHoldFiltersSchema>;

export const LEGAL_HOLD_FILTER_DEFAULTS: LegalHoldFilters = {
  search: '',
  status: 'all',
};

export const parseLegalHoldFilters = createSearchParamsParser(legalHoldFiltersSchema);
