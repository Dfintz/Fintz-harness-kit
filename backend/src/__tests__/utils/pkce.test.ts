import crypto from 'node:crypto';

import { generatePkcePair } from '../../utils/pkce';

describe('generatePkcePair', () => {
  it('returns a verifier of valid length and character set (RFC 7636 §4.1)', () => {
    const { verifier } = generatePkcePair();

    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('derives challenge as base64url(SHA256(verifier)) per RFC 7636 §4.2', () => {
    const { verifier, challenge } = generatePkcePair();

    const expected = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
    // base64url is unpadded
    expect(challenge).not.toContain('=');
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
  });

  it('uses the S256 method', () => {
    expect(generatePkcePair().method).toBe('S256');
  });

  it('produces a unique pair on each call', () => {
    const a = generatePkcePair();
    const b = generatePkcePair();

    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
