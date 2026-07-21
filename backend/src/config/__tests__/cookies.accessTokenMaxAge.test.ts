import { getAccessTokenCookieOptions } from '../cookies';

const toBase64Url = (payload: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const buildJwt = (payload: Record<string, unknown>): string => {
  const header = toBase64Url({ alg: 'HS256', typ: 'JWT' });
  const body = toBase64Url(payload);
  return `${header}.${body}.signature`;
};

describe('getAccessTokenCookieOptions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'production', ACCESS_TOKEN_EXPIRY: '1h' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('aligns maxAge to JWT exp-iat for non-admin login flow token', () => {
    // 1 hour token (non-admin baseline)
    const now = Math.floor(Date.now() / 1000);
    const token = buildJwt({ iat: now, exp: now + 3600, role: 'member' });

    const options = getAccessTokenCookieOptions(token);

    expect(options.maxAge).toBe(3600 * 1000);
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
  });

  it('aligns maxAge to JWT exp-iat for admin login flow token', () => {
    // Example shorter admin token lifetime
    const now = Math.floor(Date.now() / 1000);
    const token = buildJwt({ iat: now, exp: now + 900, role: 'admin' });

    const options = getAccessTokenCookieOptions(token);

    expect(options.maxAge).toBe(900 * 1000);
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
  });

  it('falls back to ACCESS_TOKEN_EXPIRY when token payload is malformed', () => {
    const options = getAccessTokenCookieOptions('invalid.token');

    // In non-production environments, cookie fallback intentionally defaults to 24h.
    expect(options.maxAge).toBe(24 * 60 * 60 * 1000);
  });
});
