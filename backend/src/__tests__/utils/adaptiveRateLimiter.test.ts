import { AdaptiveRateLimiter } from '../../utils/adaptiveRateLimiter';

/**
 * Deterministic fake clock: `sleep` advances the virtual clock so pacing math
 * can be asserted without real timers.
 */
function createFakeClock() {
  const state = { nowMs: 0 };
  const now = (): number => state.nowMs;
  const sleep = jest.fn(async (ms: number): Promise<void> => {
    state.nowMs += ms;
  });
  const advance = (ms: number): void => {
    state.nowMs += ms;
  };
  return { now, sleep, advance, state };
}

describe('AdaptiveRateLimiter', () => {
  describe('proactive pacing', () => {
    it('does not wait on the first acquisition', async () => {
      const clock = createFakeClock();
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 250,
        maxIntervalMs: 5000,
        now: clock.now,
        sleep: clock.sleep,
      });

      const waited = await limiter.acquire();

      expect(waited).toBe(0);
      expect(clock.sleep).not.toHaveBeenCalled();
    });

    it('spaces subsequent acquisitions by the minimum interval', async () => {
      const clock = createFakeClock();
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 200,
        maxIntervalMs: 5000,
        now: clock.now,
        sleep: clock.sleep,
      });

      await limiter.acquire(); // immediate
      const second = await limiter.acquire();
      const third = await limiter.acquire();

      expect(second).toBe(200);
      expect(third).toBe(200);
      const stats = limiter.getStats();
      expect(stats.acquisitions).toBe(3);
      expect(stats.totalWaitMs).toBe(400);
    });

    it('does not wait when the caller already spent enough time between ops', async () => {
      const clock = createFakeClock();
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 200,
        maxIntervalMs: 5000,
        now: clock.now,
        sleep: clock.sleep,
      });

      await limiter.acquire(); // reserves slot at +200
      clock.advance(500); // caller did slow work
      const waited = await limiter.acquire();

      expect(waited).toBe(0);
      expect(clock.sleep).not.toHaveBeenCalled();
    });
  });

  describe('adaptive backpressure', () => {
    it('ramps the interval up on backpressure, capped at maxIntervalMs', () => {
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 100,
        maxIntervalMs: 800,
        backoffMultiplier: 3,
      });

      limiter.recordBackpressure(); // 100 -> 300
      expect(limiter.getStats().currentIntervalMs).toBe(300);

      limiter.recordBackpressure(); // 300 -> 800 (capped, not 900)
      expect(limiter.getStats().currentIntervalMs).toBe(800);
      expect(limiter.getStats().peakIntervalMs).toBe(800);
      expect(limiter.getStats().backpressureEvents).toBe(2);
    });

    it('decays the interval back toward the baseline on success', () => {
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 100,
        maxIntervalMs: 1600,
        backoffMultiplier: 2,
        recoveryMultiplier: 0.5,
      });

      limiter.recordBackpressure(); // 200
      limiter.recordBackpressure(); // 400
      expect(limiter.getStats().currentIntervalMs).toBe(400);

      limiter.recordSuccess(); // 200
      expect(limiter.getStats().currentIntervalMs).toBe(200);

      limiter.recordSuccess(); // 100
      limiter.recordSuccess(); // clamped at min, not below
      expect(limiter.getStats().currentIntervalMs).toBe(100);
    });

    it('honors a retry-after hint as a hard cooldown on the next acquisition', async () => {
      const clock = createFakeClock();
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 100,
        maxIntervalMs: 1000,
        maxCooldownMs: 30_000,
        now: clock.now,
        sleep: clock.sleep,
      });

      await limiter.acquire(); // immediate, reserves +100
      limiter.recordBackpressure(5000); // retry-after 5s

      const waited = await limiter.acquire();

      expect(waited).toBe(5000);
      expect(clock.sleep).toHaveBeenCalledWith(5000);
    });

    it('caps an oversized retry-after hint at maxCooldownMs', async () => {
      const clock = createFakeClock();
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 100,
        maxIntervalMs: 1000,
        maxCooldownMs: 10_000,
        now: clock.now,
        sleep: clock.sleep,
      });

      await limiter.acquire();
      limiter.recordBackpressure(120_000); // hostile 2-minute hint

      const waited = await limiter.acquire();

      expect(waited).toBe(10_000);
    });

    it('ignores a non-positive retry-after hint for cooldown but still ramps', () => {
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 100,
        maxIntervalMs: 1000,
      });

      limiter.recordBackpressure(0);
      limiter.recordBackpressure(-50);

      expect(limiter.getStats().backpressureEvents).toBe(2);
      expect(limiter.getStats().currentIntervalMs).toBe(400); // 100 -> 200 -> 400
    });
  });

  describe('option normalization', () => {
    it('clamps maxIntervalMs to be at least minIntervalMs', () => {
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 500,
        maxIntervalMs: 100, // invalid: below min
        backoffMultiplier: 2,
      });

      limiter.recordBackpressure(); // 500 * 2 -> clamped to max (== min == 500)
      expect(limiter.getStats().currentIntervalMs).toBe(500);
    });

    it('exposes the configured label', () => {
      const limiter = new AdaptiveRateLimiter({
        minIntervalMs: 100,
        maxIntervalMs: 1000,
        label: 'role-sync',
      });

      expect(limiter.getLabel()).toBe('role-sync');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
