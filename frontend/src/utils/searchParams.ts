/**
 * Typed URL search-param parser/serializer helpers.
 *
 * Phase 3 of the architectural rework: filter state lives in the URL, not in
 * `useState`. This makes filters:
 *   - shareable (copy/paste URL → same filtered view)
 *   - back/forward-button safe
 *   - server-prefetchable (route loaders can read them)
 *   - resilient against component remounts and navigation
 *
 * Usage:
 *   const filtersSchema = z.object({
 *     status: z.enum(['all', 'owned']).default('all'),
 *     search: z.string().default(''),
 *     page: z.coerce.number().int().positive().default(1),
 *   });
 *   const parseFilters = createSearchParamsParser(filtersSchema);
 *
 *   // In component:
 *   const [params, setParams] = useSearchParams();
 *   const filters = useMemo(() => parseFilters(params), [params]);
 *
 * Notes:
 *   - Parsing is lenient: invalid input falls back to schema defaults so a
 *     malformed URL never crashes the page. Validation errors are logged.
 *   - Serializer omits values equal to the schema default to keep URLs clean.
 *   - Numbers/booleans use `z.coerce.*` because URL params are always strings.
 */

import type { z } from 'zod';

import { logger } from './logger';

export type SearchParamsParser<S extends z.ZodType> = (params: URLSearchParams) => z.infer<S>;

/**
 * Build a typed parser from a Zod schema. The returned function is safe — a
 * malformed URL falls back to schema defaults rather than throwing.
 */
export function createSearchParamsParser<S extends z.ZodType>(schema: S): SearchParamsParser<S> {
  return (params: URLSearchParams): z.infer<S> => {
    const obj: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      // Last writer wins for duplicate keys — matches URLSearchParams.get() semantics.
      obj[key] = value;
    }
    const result = schema.safeParse(obj);
    if (result.success) return result.data;

    logger.warn('searchParams: validation failed, falling back to defaults', {
      issues: result.error.issues,
    });
    // Falling back to defaults: parse an empty object and let schema fill in.
    return schema.parse({}) as z.infer<S>;
  };
}

/**
 * Build a `URLSearchParams` from a partial filter object.
 *
 * Values that are `undefined`, `null`, empty string, or equal to the
 * corresponding default are omitted to keep the URL clean. Use this from
 * `setSearchParams(buildSearchParams(...))` callers.
 */
export function buildSearchParams<T extends Record<string, unknown>>(
  values: T,
  defaults: Partial<T> = {}
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    if (defaults[key as keyof T] !== undefined && defaults[key as keyof T] === value) {
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      // Skip objects/arrays — callers should serialize them explicitly.
      continue;
    }
    params.set(key, String(value));
  }
  return params;
}
