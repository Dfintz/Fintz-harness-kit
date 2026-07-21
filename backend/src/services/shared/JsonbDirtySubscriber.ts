/**
 * JsonbDirtySubscriber
 *
 * Eliminates a long-standing TypeORM 0.3 footgun: in-place mutations of
 * `jsonb` / `json` / `simple-json` / `simple-array` columns are silently
 * dropped on `repository.save(entity)`.
 *
 * Why the bug exists
 * ------------------
 * TypeORM tracks dirty columns by comparing the saved entity to a
 * "databaseEntity" snapshot. For JSON columns it compares values, but for
 * entities that were just loaded into memory the snapshot holds the SAME
 * object reference as the entity property. When a developer writes:
 *
 *     entity.settings.foo = 'bar';
 *     await repo.save(entity);
 *
 * both `entity.settings` and `snapshot.settings` point to the same mutated
 * object. The diff sees them as equal, no UPDATE is generated, the call
 * returns 200 OK with stale data, and the next read shows the change "lost".
 * This is the root cause of the recurring "delete reverts on refresh" /
 * "save doesn't stick" / "filter checkbox toggles back" regressions.
 *
 * Why this fix works
 * ------------------
 * On `afterLoad` we deep-clone every JSON-typed property and assign the clone
 * back onto the entity. The snapshot inside TypeORM's persistence machinery
 * still holds the original reference. Subsequent in-place mutations now
 * affect ONLY the entity's clone — the diff sees two distinct values and
 * correctly emits an UPDATE.
 *
 * Cost
 * ----
 * One `structuredClone` per JSON column per entity load. Negligible compared
 * to the SQL round-trip itself. No additional UPDATE statements are
 * generated for unchanged data — TypeORM's value-based comparison still
 * suppresses no-op writes when the cloned and original values are equal.
 *
 * Authoring guidance (still valid)
 * --------------------------------
 * Prefer the explicit spread pattern in new code for clarity:
 *
 *     entity.settings = { ...entity.settings, foo: 'bar' };
 *
 * The subscriber exists as a safety net so that older code, AI-generated
 * patches, and contributors unfamiliar with the pitfall cannot silently
 * regress data persistence.
 *
 * See: /memories/repo/typeorm-jsonb-pitfall.md
 */

import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from 'typeorm';

const JSON_COLUMN_TYPES = new Set<string>(['jsonb', 'json', 'simple-json', 'simple-array']);

@EventSubscriber()
export class JsonbDirtySubscriber implements EntitySubscriberInterface {
  /**
   * Runs after every entity hydration. Replaces JSON-typed property values
   * with deep clones so they no longer share a reference with TypeORM's
   * internal change-tracking snapshot.
   */
  afterLoad(entity: unknown, event?: LoadEvent<unknown>): void {
    if (entity === null || entity === undefined || typeof entity !== 'object') {
      return;
    }
    const metadata = event?.metadata;
    if (!metadata) {
      return;
    }

    const target = entity as Record<string, unknown>;
    for (const column of metadata.columns) {
      const columnType = typeof column.type === 'string' ? column.type : '';
      if (!JSON_COLUMN_TYPES.has(columnType)) {
        continue;
      }

      const value = target[column.propertyName];
      // Primitives (including null/undefined) are immutable — only
      // object/array references can be mutated in place.
      if (value === null || value === undefined || typeof value !== 'object') {
        continue;
      }

      target[column.propertyName] = structuredClone(value);
    }
  }
}

