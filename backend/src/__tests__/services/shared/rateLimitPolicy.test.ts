import {
  buildRateLimitKey,
  rateLimitRetryAfterSeconds,
  type RateLimitResult,
} from '../../../services/shared/rateLimitPolicy';

function resultResettingAt(ms: number): RateLimitResult {
  return { allowed: false, remaining: 0, resetAt: new Date(ms) };
}

describe('buildRateLimitKey', () => {
  it('joins domain, action, and scope segments with colons', () => {
    expect(buildRateLimitKey('lfg', 'post', 'guild-1', 'user-1')).toBe('lfg:post:guild-1:user-1');
  });

  it('supports a single scope segment', () => {
    expect(buildRateLimitKey('auth', 'login', 'user-1')).toBe('auth:login:user-1');
  });

  it('supports no scope segments (global action)', () => {
    expect(buildRateLimitKey('system', 'broadcast')).toBe('system:broadcast');
  });

  it('preserves the exact legacy lfg key format (byte-identical migration)', () => {
    // Mirrors the previous hand-built `lfg:post:${guildId ?? 'DM'}:${userId}`.
    const guildId: string | null = null;
    const userId = 'user-42';
    expect(buildRateLimitKey('lfg', 'post', guildId ?? 'DM', userId)).toBe('lfg:post:DM:user-42');
    expect(buildRateLimitKey('lfg', 'join', 'guild-9', userId)).toBe('lfg:join:guild-9:user-42');
  });
});

describe('rateLimitRetryAfterSeconds', () => {
  const now = 1_000_000;

  it('returns whole seconds until reset, rounding up', () => {
    // 2500ms in the future → ceil(2.5) = 3
    expect(rateLimitRetryAfterSeconds(resultResettingAt(now + 2500), now)).toBe(3);
  });

  it('rounds an exact second boundary without inflating', () => {
    expect(rateLimitRetryAfterSeconds(resultResettingAt(now + 3000), now)).toBe(3);
  });

  it('returns 0 when the reset is already in the past', () => {
    expect(rateLimitRetryAfterSeconds(resultResettingAt(now - 5000), now)).toBe(0);
  });

  it('returns 0 when the reset is exactly now', () => {
    expect(rateLimitRetryAfterSeconds(resultResettingAt(now), now)).toBe(0);
  });

  it('defaults the clock to Date.now when not supplied', () => {
    const result = resultResettingAt(Date.now() + 10_000);
    const seconds = rateLimitRetryAfterSeconds(result);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(10);
  });
});
