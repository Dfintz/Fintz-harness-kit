/**
 * Query Parameter Parser Middleware for API v2
 * Parses standardized query parameters per ROADMAP.md section 2.3:
 * - Offset-based pagination: ?limit=20&offset=40
 * - Sorting: ?sort=-createdAt (prefix - for descending)
 * - Filtering: ?filter[status]=active
 * - Field selection: ?fields=id,name,createdAt
 * - Search: ?search=keyword
 */

import { NextFunction, Request, Response } from 'express';

import { ParsedQueryParams } from '../types/api';

// Default values for query parameters
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse query parameters into standardized format
 */
export function parseQueryParams(query: Record<string, unknown>): ParsedQueryParams {
  // Parse limit
  let limit = Number.parseInt(query.limit as string) || DEFAULT_LIMIT;
  limit = Math.min(Math.max(1, limit), MAX_LIMIT);

  // Parse offset (support both offset and page-based)
  let offset = Number.parseInt(query.offset as string);
  if (Number.isNaN(offset)) {
    // Fallback to page-based pagination
    const page = Number.parseInt(query.page as string) || 1;
    offset = (page - 1) * limit;
  }
  offset = Math.max(0, offset);

  // Parse sort parameter: -fieldName for descending, fieldName for ascending
  let sort: { field: string; order: 'ASC' | 'DESC' } | null = null;
  if (query.sort && typeof query.sort === 'string') {
    const sortParam = query.sort.trim();
    if (sortParam.startsWith('-')) {
      sort = { field: sortParam.substring(1), order: 'DESC' };
    } else if (sortParam.startsWith('+')) {
      sort = { field: sortParam.substring(1), order: 'ASC' };
    } else {
      sort = { field: sortParam, order: 'ASC' };
    }
  }

  // Parse filters: filter[field]=value or filter[field][]=value1&filter[field][]=value2
  // Express's default extended query parser (qs) collapses bracket syntax into a nested
  // object: ?filter[status]=active becomes { filter: { status: 'active' } }. We support
  // both that shape and the literal-bracket key shape used in tests/legacy clients.
  const filters: Record<string, string | string[]> = {};
  const filterRegex = /^filter\[([^\]]+)\]$/;

  const assignFilter = (field: string, value: unknown): void => {
    if (Array.isArray(value)) {
      filters[field] = value.filter(v => typeof v === 'string' || typeof v === 'number').map(String);
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      filters[field] = String(value);
    }
  };

  Object.keys(query).forEach(key => {
    const filterMatch = filterRegex.exec(key);
    if (filterMatch) {
      assignFilter(filterMatch[1], query[key]);
    }
  });

  // NOSONAR: Improper Type Validation FP — the typeof+Array.isArray guard below validates the
  // shape before any property access, and assignFilter() further validates each value.
  const nestedFilter = query.filter; // NOSONAR
  if (nestedFilter && typeof nestedFilter === 'object' && !Array.isArray(nestedFilter)) {
    Object.entries(nestedFilter as Record<string, unknown>).forEach(([field, value]) => {
      assignFilter(field, value);
    });
  }

  // Parse fields: comma-separated list
  let fields: string[] | null = null;
  if (query.fields && typeof query.fields === 'string') {
    fields = query.fields
      .split(',')
      .map((f: string) => f.trim())
      .filter(Boolean);
  }

  // Parse search term
  // NOSONAR: Improper Type Validation FP — typeof guard validates query.search is a string before use
  const search = typeof query.search === 'string' ? query.search.trim() || null : null; // NOSONAR

  return {
    limit,
    offset,
    sort,
    filters,
    fields,
    search,
  };
}

/**
 * Build HATEOAS links for paginated responses
 */
export function buildHateoasLinks(
  basePath: string,
  offset: number,
  limit: number,
  total: number,
  queryParams?: Record<string, string>
): { self: string; first: string; prev?: string; next?: string; last: string } {
  const buildUrl = (newOffset: number): string => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(newOffset));

    // Add any additional query params
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (key !== 'limit' && key !== 'offset') {
          params.set(key, value);
        }
      });
    }

    return `${basePath}?${params.toString()}`;
  };

  const lastOffset = Math.max(0, Math.floor((total - 1) / limit) * limit);
  const links: { self: string; first: string; prev?: string; next?: string; last: string } = {
    self: buildUrl(offset),
    first: buildUrl(0),
    last: buildUrl(lastOffset),
  };

  if (offset > 0) {
    links.prev = buildUrl(Math.max(0, offset - limit));
  }

  if (offset + limit < total) {
    links.next = buildUrl(offset + limit);
  }

  return links;
}

/**
 * Apply field selection to an object
 */
export function selectFields<T extends object>(obj: T, fields: string[] | null): Partial<T> {
  if (!fields || fields.length === 0) {
    return obj;
  }

  const result: Partial<T> = {};
  fields.forEach(field => {
    if (field in obj) {
      (result as Record<string, unknown>)[field] = (obj as Record<string, unknown>)[field];
    }
  });
  return result;
}

/**
 * Apply field selection to an array of objects
 */
export function selectFieldsFromArray<T extends object>(
  items: T[],
  fields: string[] | null
): Partial<T>[] {
  if (!fields || fields.length === 0) {
    return items;
  }
  return items.map(item => selectFields(item, fields));
}

/**
 * Middleware to parse query parameters and attach to request
 */
export const queryParserMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  req.queryParams = parseQueryParams(req.query);
  next();
};

/**
 * Helper to check if a field matches any of the allowed variations
 */
function fieldMatchesAllowed(field: string, allowedFields: string[]): boolean {
  const fieldLower = field.toLowerCase();
  const snakeCase = field.replaceAll(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

  return (
    allowedFields.includes(field) ||
    allowedFields.includes(fieldLower) ||
    allowedFields.includes(snakeCase)
  );
}

/**
 * Validate sort field against allowed fields
 */
export function validateSortField(
  sort: { field: string; order: 'ASC' | 'DESC' } | null,
  allowedFields: string[]
): { field: string; order: 'ASC' | 'DESC' } | null {
  if (!sort) {
    return null;
  }

  if (fieldMatchesAllowed(sort.field, allowedFields)) {
    return sort;
  }

  // Return null if field is not allowed
  return null;
}

/**
 * Validate filter fields against allowed fields
 */
export function validateFilters(
  filters: Record<string, string | string[]>,
  allowedFields: string[]
): Record<string, string | string[]> {
  const validFilters: Record<string, string | string[]> = {};

  Object.entries(filters).forEach(([field, value]) => {
    if (fieldMatchesAllowed(field, allowedFields)) {
      validFilters[field] = value;
    }
  });

  return validFilters;
}
