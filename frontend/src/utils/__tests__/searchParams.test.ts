/**
 * Tests for the typed URL search-param parser/serializer helpers.
 */

import { z } from 'zod';

import { buildSearchParams, createSearchParamsParser } from '@/utils/searchParams';

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const schema = z.object({
  status: z.enum(['all', 'open', 'closed']).default('all'),
  search: z.string().default(''),
  page: z.coerce.number().int().positive().default(1),
});

describe('createSearchParamsParser', () => {
  const parse = createSearchParamsParser(schema);

  it('returns full defaults for an empty URLSearchParams', () => {
    expect(parse(new URLSearchParams())).toEqual({
      status: 'all',
      search: '',
      page: 1,
    });
  });

  it('parses provided values and coerces numeric strings', () => {
    const params = new URLSearchParams('status=open&search=alpha&page=3');
    expect(parse(params)).toEqual({ status: 'open', search: 'alpha', page: 3 });
  });

  it('falls back to defaults when a value fails enum validation', () => {
    const params = new URLSearchParams('status=garbage&page=2');
    // Whole object falls back to defaults on safeParse failure.
    expect(parse(params)).toEqual({ status: 'all', search: '', page: 1 });
  });

  it('falls back to defaults when a numeric coercion fails', () => {
    const params = new URLSearchParams('page=not-a-number');
    expect(parse(params)).toEqual({ status: 'all', search: '', page: 1 });
  });

  it('ignores extra unknown keys', () => {
    const params = new URLSearchParams('status=open&unknown=ignored');
    expect(parse(params)).toMatchObject({ status: 'open' });
  });
});

describe('buildSearchParams', () => {
  const defaults = { status: 'all', search: '', page: 1 } as const;

  it('omits values equal to the provided default', () => {
    const params = buildSearchParams({ status: 'all', search: '', page: 1 }, defaults);
    expect(params.toString()).toBe('');
  });

  it('serializes overridden primitive values', () => {
    const params = buildSearchParams({ status: 'open', search: 'alpha', page: 2 }, defaults);
    expect(params.get('status')).toBe('open');
    expect(params.get('search')).toBe('alpha');
    expect(params.get('page')).toBe('2');
  });

  it('omits undefined, null, and empty-string values', () => {
    const params = buildSearchParams({ a: undefined, b: null, c: '', d: 'kept' });
    expect(params.toString()).toBe('d=kept');
  });

  it('drops non-primitive values rather than emitting [object Object]', () => {
    const params = buildSearchParams({ obj: { nested: true }, arr: [1, 2], ok: 'yes' });
    expect(params.has('obj')).toBe(false);
    expect(params.has('arr')).toBe(false);
    expect(params.get('ok')).toBe('yes');
  });

  it('serializes booleans and numbers', () => {
    const params = buildSearchParams({ active: true, count: 0 });
    expect(params.get('active')).toBe('true');
    expect(params.get('count')).toBe('0');
  });
});
