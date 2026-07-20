import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UseUrlFiltersOptions<F extends object> {
  /** Pure parser that turns a URLSearchParams into a fully-defaulted filter object. */
  parse: (params: URLSearchParams) => F;
  /**
   * Default filter values. A patch entry equal to its default is removed from
   * the URL so the query string only contains user-overridden values.
   */
  defaults: F;
  /**
   * Filter keys that represent pagination. When any other key changes, all of
   * these are removed from the URL (so changing a filter resets paging).
   */
  paginationKeys?: ReadonlyArray<keyof F>;
}

export interface UseUrlFiltersResult<F extends object> {
  /** Fully-parsed, fully-defaulted filter values derived from the current URL. */
  filters: F;
  /**
   * Apply a partial update to the filter URL.
   *
   * - Values equal to the schema default (or empty/undefined) are removed.
   * - Mutating any non-pagination key clears all `paginationKeys` from the URL.
   * - Uses `replace: true` so filter churn doesn't pollute browser history.
   */
  updateFilters: (patch: Partial<F>) => void;
}

/**
 * Backs a page's filter & pagination state with `URLSearchParams`.
 *
 * Pages get the same ergonomics as `useState` but gain refresh-safety,
 * deep-linkability, and back/forward navigation for free. Schema validation,
 * defaulting, and coercion are owned by the `parse` function (typically a
 * Zod schema fed through `createSearchParamsParser`).
 */
export function useUrlFilters<F extends object>(
  options: UseUrlFiltersOptions<F>
): UseUrlFiltersResult<F> {
  const { parse, defaults, paginationKeys } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => parse(searchParams), [parse, searchParams]);

  const updateFilters = useCallback(
    (patch: Partial<F>) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          let touchedNonPagination = false;
          for (const [key, value] of Object.entries(patch)) {
            const typedKey = key as keyof F;
            if (!paginationKeys?.includes(typedKey)) {
              touchedNonPagination = true;
            }
            const isDefault = value === undefined || value === '' || value === defaults[typedKey];
            if (isDefault) {
              next.delete(key);
            } else if (
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
            ) {
              next.set(key, String(value));
            } else {
              // Non-primitive filter values are not representable in a query
              // string. Drop them rather than serializing `[object Object]`.
              next.delete(key);
            }
          }
          if (touchedNonPagination && paginationKeys) {
            for (const key of paginationKeys) {
              next.delete(String(key));
            }
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams, defaults, paginationKeys]
  );

  return { filters, updateFilters };
}
