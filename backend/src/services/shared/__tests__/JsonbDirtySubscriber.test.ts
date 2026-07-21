/**
 * Unit test for JsonbDirtySubscriber.
 *
 * Validates the core contract: after `afterLoad` runs, JSON-typed properties
 * on the entity no longer share a reference with the value passed in. This is
 * the property that makes TypeORM's downstream change-detection correctly
 * notice in-place mutations.
 *
 * Full end-to-end persistence verification (real PostgreSQL) lives in the
 * integration suite added separately; this unit test exercises the subscriber
 * in isolation so it can run in any environment.
 */

import 'reflect-metadata';
import type { EntityMetadata, LoadEvent } from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';

import { JsonbDirtySubscriber } from '../JsonbDirtySubscriber';

interface FakeColumn {
  propertyName: string;
  type: string;
}

function buildLoadEvent(columns: FakeColumn[]): LoadEvent<unknown> {
  const metadata = {
    columns: columns as unknown as ColumnMetadata[],
  } as unknown as EntityMetadata;
  return { metadata } as LoadEvent<unknown>;
}

describe('JsonbDirtySubscriber', () => {
  const subscriber = new JsonbDirtySubscriber();

  it('clones jsonb object properties so they no longer share a reference', () => {
    const originalSettings = { theme: 'dark', flags: { beta: true } };
    const entity: Record<string, unknown> = { id: 'a', settings: originalSettings };
    const event = buildLoadEvent([
      { propertyName: 'id', type: 'uuid' },
      { propertyName: 'settings', type: 'jsonb' },
    ]);

    subscriber.afterLoad(entity, event);

    expect(entity.settings).not.toBe(originalSettings);
    expect(entity.settings).toEqual(originalSettings);
    // Mutating the entity's value must not affect the original snapshot.
    (entity.settings as { theme: string }).theme = 'light';
    expect(originalSettings.theme).toBe('dark');
  });

  it.each(['json', 'simple-json', 'simple-array'])('clones %s columns as well', columnType => {
    const original = ['a', 'b', 'c'];
    const entity: Record<string, unknown> = { tags: original };
    const event = buildLoadEvent([{ propertyName: 'tags', type: columnType }]);

    subscriber.afterLoad(entity, event);

    expect(entity.tags).not.toBe(original);
    expect(entity.tags).toEqual(original);
  });

  it('leaves non-JSON columns untouched', () => {
    const arrayValue = [1, 2, 3];
    const entity: Record<string, unknown> = { name: 'hello', payload: arrayValue };
    const event = buildLoadEvent([
      { propertyName: 'name', type: 'varchar' },
      { propertyName: 'payload', type: 'varchar' },
    ]);

    subscriber.afterLoad(entity, event);

    expect(entity.payload).toBe(arrayValue);
    expect(entity.name).toBe('hello');
  });

  it('skips null and undefined values', () => {
    const entity: Record<string, unknown> = { settings: null, prefs: undefined };
    const event = buildLoadEvent([
      { propertyName: 'settings', type: 'jsonb' },
      { propertyName: 'prefs', type: 'jsonb' },
    ]);

    expect(() => subscriber.afterLoad(entity, event)).not.toThrow();
    expect(entity.settings).toBeNull();
    expect(entity.prefs).toBeUndefined();
  });

  it('skips primitive jsonb values (numbers, strings, booleans)', () => {
    const entity: Record<string, unknown> = {
      counter: 42,
      label: 'text',
      flag: true,
    };
    const event = buildLoadEvent([
      { propertyName: 'counter', type: 'jsonb' },
      { propertyName: 'label', type: 'jsonb' },
      { propertyName: 'flag', type: 'jsonb' },
    ]);

    subscriber.afterLoad(entity, event);

    expect(entity.counter).toBe(42);
    expect(entity.label).toBe('text');
    expect(entity.flag).toBe(true);
  });

  it('handles entity without metadata gracefully (no event)', () => {
    const entity = { settings: { a: 1 } };
    expect(() => subscriber.afterLoad(entity)).not.toThrow();
  });

  it('ignores non-object entity values', () => {
    expect(() => subscriber.afterLoad(null)).not.toThrow();
    expect(() => subscriber.afterLoad(undefined)).not.toThrow();
    expect(() => subscriber.afterLoad('string-entity')).not.toThrow();
  });

  it('deep-clones nested structures (would otherwise share inner references)', () => {
    const inner = { count: 0 };
    const original = { stats: inner };
    const entity: Record<string, unknown> = { metadata: original };
    const event = buildLoadEvent([{ propertyName: 'metadata', type: 'jsonb' }]);

    subscriber.afterLoad(entity, event);

    const clonedMetadata = entity.metadata as { stats: { count: number } };
    expect(clonedMetadata.stats).not.toBe(inner);
    clonedMetadata.stats.count = 99;
    expect(inner.count).toBe(0);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

