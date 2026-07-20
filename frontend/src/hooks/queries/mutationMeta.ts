/**
 * Declarative mutation invalidation contract.
 *
 * BACKGROUND
 * ----------
 * The default mutation pattern in TanStack Query requires every hook to write
 * boilerplate `onSuccess` blocks that call `queryClient.invalidateQueries(...)`
 * for each cache key affected by the mutation. The result across this codebase:
 *
 *   - Inconsistent invalidation (some mutations forget keys → stale UI)
 *   - Optimistic updates that lie about JSONB shapes → "save snaps back"
 *   - Hard to audit which cache slices a mutation touches
 *
 * THIS MODULE
 * -----------
 * Provides a single typed extension point: every `useMutation` call now sets
 * `meta.invalidates`, and a single global handler in `queryClient.ts` performs
 * the invalidation in one place. Authors only declare *what* to invalidate;
 * the *how* is centralised.
 *
 *   meta: { invalidates: [organizationKeys.settings(orgId)] }
 *
 * Or, when invalidations depend on the mutation result/variables, use a
 * function form:
 *
 *   meta: {
 *     invalidates: (data, variables) => [
 *       fleetKeys.detail(variables.fleetId),
 *       fleetKeys.lists(),
 *     ],
 *   }
 *
 * The handler in `queryClient.ts` resolves both forms.
 *
 * AUTHORING RULE
 * --------------
 * For mutations that touch JSONB-backed entities, prefer invalidation over
 * optimistic updates. The combination of TypeORM's reference-based JSONB
 * change-detection (see /memories/repo/typeorm-jsonb-pitfall.md) and
 * speculative client-side cache writes is the root cause of the "settings
 * snap back to old value" class of bugs.
 *
 * ESLint enforces presence of `meta` on `useMutation` calls; see
 * `frontend/eslint.config.mjs`.
 */

import type { QueryKey } from '@tanstack/react-query';

/**
 * Static or computed list of cache keys that a mutation should invalidate
 * after success. Entries may be `undefined`/`null`/`false` and are filtered
 * by the global handler — useful when an invalidation is conditional on
 * a key factory that returns undefined for missing IDs.
 *
 * - Static form: `[someKeys.list(), someKeys.detail(id)]`
 * - Function form: receives the mutation `data` and `variables`, returns the
 *   key list. Use this when the keys depend on what was mutated.
 *
 * The function form's args are typed as `any` because TanStack's
 * `Register.mutationMeta` augmentation is global and cannot be parameterised
 * per-mutation. Authors get inference at the call site from the original
 * destructuring shape.
 */
export type InvalidatesEntry = QueryKey | undefined | null | false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InvalidatesFn = (data: any, variables: any) => readonly InvalidatesEntry[];
export type Invalidates = readonly InvalidatesEntry[] | InvalidatesFn;

/**
 * Augmentation of TanStack Query's `MutationMeta` type so that
 * `meta.invalidates` is typed throughout the app.
 *
 * Module augmentation must happen at module load time; importing this file
 * anywhere is sufficient. The `queryClient.ts` module already imports it.
 */
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /**
       * Cache keys to invalidate when this mutation succeeds. Resolved by the
       * global handler in `queryClient.ts`. Omit only for mutations whose
       * effect is purely client-side (rare).
       */
      invalidates?: Invalidates;
    };
  }
}

/**
 * Resolve an `Invalidates` value to a concrete list of `QueryKey`s.
 *
 * Exported for use by the global mutation cache handler and by tests.
 */
export function resolveInvalidates(
  invalidates: Invalidates | undefined,
  data: unknown,
  variables: unknown
): QueryKey[] {
  if (!invalidates) {
    return [];
  }
  const entries = typeof invalidates === 'function' ? invalidates(data, variables) : invalidates;
  return entries.filter((k): k is QueryKey => Boolean(k));
}
