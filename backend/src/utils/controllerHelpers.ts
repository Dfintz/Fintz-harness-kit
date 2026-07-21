/**
 * Common helper functions for controllers to reduce duplication
 */

import { Request } from 'express';

/**
 * Parse pagination parameters from request query
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export function parsePaginationParams(query: Request['query']): PaginationParams {
  const { page, limit, sortBy, sortOrder } = query;

  return {
    page: page ? Number.parseInt(page as string, 10) : 1,
    limit: limit ? Number.parseInt(limit as string, 10) : 20,
    sortBy: sortBy as string,
    sortOrder: sortOrder as 'ASC' | 'DESC',
  };
}

/**
 * Parse date range filter from request query
 */
export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

export function parseDateRangeFilter(query: Request['query']): DateRangeFilter {
  const { startDate, endDate } = query;
  const filter: DateRangeFilter = {};

  if (startDate) {
    filter.startDate = new Date(startDate as string);
  }
  if (endDate) {
    filter.endDate = new Date(endDate as string);
  }

  return filter;
}

/**
 * Parse status filter supporting both single status and multiple statuses
 */
export interface StatusFilter<T> {
  status?: T;
  statuses?: T[];
}

export function parseStatusFilter<T extends string>(
  query: Request['query'],
  validStatuses: readonly T[]
): StatusFilter<T> {
  const { status, statuses } = query;
  const filter: StatusFilter<T> = {};

  if (statuses) {
    const statusArray =
      typeof statuses === 'string'
        ? statuses.split(',').map(s => s.trim())
        : (statuses as string[]);

    // Validate each status value
    const validatedStatuses = statusArray.filter(s => validStatuses.includes(s as T)) as T[];

    if (validatedStatuses.length > 0) {
      filter.statuses = validatedStatuses;
    }
  } else if (status && validStatuses.includes(status as T)) {
    filter.status = status as T;
  }

  return filter;
}

/**
 * Parse search term from query
 */
export function parseSearchTerm(query: Request['query']): string | undefined {
  const { search } = query;
  return search ? (search as string) : undefined;
}
