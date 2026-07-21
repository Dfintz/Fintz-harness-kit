/**
 * Shared assertion for ADR-004 shared-types ⇄ backend enum parity contracts.
 *
 * Backend TypeORM enums are the persistence source of truth; `@sc-fleet-manager/shared-types`
 * exposes the client-facing vocabulary as runtime-introspectable `as const` arrays with derived
 * union types. Each per-domain parity test (e.g. `sharedTypesActivityParity.test.ts`,
 * `sharedTypesMissionParity.test.ts`) uses this helper to enforce the boundary rule:
 *
 *   - every shared-types value MUST exist in the corresponding backend enum (`shared ⊆ backend`);
 *   - any backend-only value (intentionally excluded from the client union) is listed in an
 *     explicit allowlist, so adding a backend enum member forces a conscious decision about client
 *     exposure.
 *
 * The check runs one-way from the backend (which may import shared-types); shared-types and the
 * frontend never import backend enums.
 *
 * This file is named `*.helper.ts` so Jest's `testPathIgnorePatterns` skips it as a test file while
 * keeping it importable by the sibling parity test suites.
 */

/**
 * Asserts the shared-types value set is a subset of the backend enum and that the backend-only
 * remainder exactly matches the documented allowlist.
 *
 * @param label - Human-readable enum name for assertion messages (e.g. `'ActivityType'`).
 * @param backendEnum - The backend TypeORM string enum object.
 * @param sharedValues - The shared-types `…_VALUES` `as const` array.
 * @param backendOnlyAllowlist - Backend enum values intentionally excluded from the client union.
 */
export function assertEnumUnionParity(
  label: string,
  backendEnum: Record<string, string>,
  sharedValues: readonly string[],
  backendOnlyAllowlist: readonly string[]
): void {
  const backendValues = Object.values(backendEnum);
  const backendSet = new Set(backendValues);
  const sharedSet = new Set(sharedValues);

  // shared ⊆ backend — no client value may be unknown to the backend.
  const sharedNotInBackend = sharedValues.filter(value => !backendSet.has(value));
  expect({ label, sharedNotInBackend }).toEqual({ label, sharedNotInBackend: [] });

  // Any backend value missing from the client union must be an explicitly documented exclusion.
  const backendOnly = backendValues
    .filter(value => !sharedSet.has(value))
    .sort((a, b) => a.localeCompare(b));
  const expectedBackendOnly = [...backendOnlyAllowlist].sort((a, b) => a.localeCompare(b));
  expect({ label, backendOnly }).toEqual({ label, backendOnly: expectedBackendOnly });
}
