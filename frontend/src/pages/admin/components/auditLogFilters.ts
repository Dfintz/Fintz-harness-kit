/**
 * URL-backed filter state for the Audit Log Viewer.
 *
 * Mirrors `AuditLogFilters` from `@/services/auditService`. The viewer uses
 * offset-based pagination (limit + offset) rather than page numbers, so
 * `useUrlFilters({ paginationKeys: ['offset'] })` resets the offset whenever
 * any other filter changes.
 *
 * `userId`, `action`, and `correlationId` are free-text and are submitted
 * via an "Apply" button — the URL only updates on apply (the page keeps
 * local "draft" useState for the input fields).
 *
 * See `.github/copilot-instructions.md` Frontend Conventions.
 */

import { z } from 'zod';

import { AuditCategory, AuditSeverity, type AuditLogFilters } from '@/services/auditService';
import { createSearchParamsParser } from '@/utils/searchParams';

const CATEGORY_VALUES = ['all', ...Object.values(AuditCategory)] as const;
const SEVERITY_VALUES = ['all', ...Object.values(AuditSeverity)] as const;

export const auditLogFiltersSchema = z.object({
  category: z.enum(CATEGORY_VALUES).default('all'),
  severity: z.enum(SEVERITY_VALUES).default('all'),
  userId: z.string().default(''),
  action: z.string().default(''),
  correlationId: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  limit: z.coerce.number().int().positive().max(200).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type AuditLogPageFilters = z.infer<typeof auditLogFiltersSchema>;

export const AUDIT_LOG_FILTER_DEFAULTS: AuditLogPageFilters = {
  category: 'all',
  severity: 'all',
  userId: '',
  action: '',
  correlationId: '',
  startDate: '',
  endDate: '',
  limit: 25,
  offset: 0,
};

export const parseAuditLogFilters = createSearchParamsParser(auditLogFiltersSchema);

/**
 * Build the API query parameter shape consumed by `useAuditLogs` /
 * `auditService.getLogs`. Drops the `'all'` sentinels and empty strings so
 * the server only sees populated filters.
 */
export function buildAuditLogQueryFilters(filters: AuditLogPageFilters): AuditLogFilters {
  const out: AuditLogFilters = {
    limit: filters.limit,
    offset: filters.offset,
  };
  if (filters.category !== 'all') out.category = filters.category as AuditCategory;
  if (filters.severity !== 'all') out.severity = filters.severity as AuditSeverity;
  if (filters.userId) out.userId = filters.userId;
  if (filters.action) out.action = filters.action;
  if (filters.correlationId) out.correlationId = filters.correlationId;
  if (filters.startDate) out.startDate = filters.startDate;
  if (filters.endDate) out.endDate = filters.endDate;
  return out;
}
