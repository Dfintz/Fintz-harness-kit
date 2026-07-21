import { describe, expect, it } from '@jest/globals';
import { v5, v6 } from 'uuid';

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('uuid buffer bounds regression', () => {
  it('v5 should throw RangeError for out-of-bounds external buffer writes', () => {
    expect(() => v5('buffer-bounds', DNS_NAMESPACE, new Uint8Array(8), 4)).toThrow(RangeError);
  });

  it('v6 should throw RangeError for out-of-bounds external buffer writes', () => {
    expect(() => v6({}, new Uint8Array(8), 4)).toThrow(RangeError);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
