/**
 * AdaptiveRateLimiter
 *
 * A small, framework-agnostic pacing primitive for serialized streams of async
 * operations that talk to a rate-limited downstream (e.g. a third-party API).
 *
 * It does two things:
 *  1. **Proactive pacing** — `acquire()` spaces operations out by at least
 *     `minIntervalMs`, so a large batch does not fire requests as fast as they
 *     complete.
 *  2. **Adaptive backpressure** — when the caller reports a downstream overload
 *     via `recordBackpressure()`, the spacing interval ramps up (toward
 *     `maxIntervalMs`) and an optional `retry-after` hint is honored as a hard
 *     cooldown. On each `recordSuccess()` the interval decays back toward the
 *     baseline.
 *
 * The limiter is intentionally generic: strip the calling context and it paces
 * any sequence of awaited operations. It holds in-process state only and is not
 * a distributed limiter — pair it with a process/job-level lock when global
 * single-flight behavior is required.
 */

export interface AdaptiveRateLimiterOptions {
  /** Baseline minimum interval between acquisitions, in milliseconds. */
  minIntervalMs: number;
  /** Maximum interval the limiter backs off to under sustained pressure, in milliseconds. */
  maxIntervalMs: number;
  /**
   * Multiplier (> 1) applied to the current interval each time backpressure is
   * recorded. Defaults to 2.
   */
  backoffMultiplier?: number;
  /**
   * Multiplier (0 < r <= 1) applied to the current interval on each success so it
   * recovers toward the baseline. Defaults to 0.5.
   */
  recoveryMultiplier?: number;
  /**
   * Upper bound for an honored `retry-after` cooldown, in milliseconds. Prevents a
   * single hostile hint from stalling an entire batch. Defaults to 30000.
   */
  maxCooldownMs?: number;
  /** Optional label included in {@link AdaptiveRateLimiter.getStats} for logging. */
  label?: string;
  /** Injectable clock for deterministic testing. Defaults to `Date.now`. */
  now?: () => number;
  /** Injectable sleep for deterministic testing. Defaults to a real `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
}

export interface AdaptiveRateLimiterStats {
  /** Total number of completed `acquire()` calls. */
  acquisitions: number;
  /** Number of `recordBackpressure()` calls. */
  backpressureEvents: number;
  /** Cumulative time spent waiting inside `acquire()`, in milliseconds. */
  totalWaitMs: number;
  /** Largest interval the limiter reached during its lifetime, in milliseconds. */
  peakIntervalMs: number;
  /** Current spacing interval, in milliseconds. */
  currentIntervalMs: number;
}

const DEFAULT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_RECOVERY_MULTIPLIER = 0.5;
const DEFAULT_MAX_COOLDOWN_MS = 30_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class AdaptiveRateLimiter {
  private readonly minIntervalMs: number;
  private readonly maxIntervalMs: number;
  private readonly backoffMultiplier: number;
  private readonly recoveryMultiplier: number;
  private readonly maxCooldownMs: number;
  private readonly label: string;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  private currentIntervalMs: number;
  private nextAllowedAt = 0;

  private acquisitions = 0;
  private backpressureEvents = 0;
  private totalWaitMs = 0;
  private peakIntervalMs: number;

  constructor(options: AdaptiveRateLimiterOptions) {
    const min = Math.max(0, options.minIntervalMs);
    // maxInterval can never be below the baseline.
    this.minIntervalMs = min;
    this.maxIntervalMs = Math.max(min, options.maxIntervalMs);
    this.backoffMultiplier = Math.max(1, options.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER);
    this.recoveryMultiplier = clamp(
      options.recoveryMultiplier ?? DEFAULT_RECOVERY_MULTIPLIER,
      0.01,
      1
    );
    this.maxCooldownMs = Math.max(0, options.maxCooldownMs ?? DEFAULT_MAX_COOLDOWN_MS);
    this.label = options.label ?? 'adaptive-rate-limiter';
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;

    this.currentIntervalMs = this.minIntervalMs;
    this.peakIntervalMs = this.minIntervalMs;
  }

  /**
   * Wait until the next operation is permitted, then reserve the following slot.
   * Returns the number of milliseconds spent waiting (0 if no wait was needed).
   */
  async acquire(): Promise<number> {
    const now = this.now();
    const waitMs = Math.max(0, this.nextAllowedAt - now);

    if (waitMs > 0) {
      await this.sleep(waitMs);
      this.totalWaitMs += waitMs;
    }

    // Reserve the next slot relative to when this acquisition actually proceeds.
    this.nextAllowedAt = now + waitMs + this.currentIntervalMs;
    this.acquisitions += 1;
    return waitMs;
  }

  /** Report a successful downstream operation; decays the interval toward the baseline. */
  recordSuccess(): void {
    this.currentIntervalMs = clamp(
      this.currentIntervalMs * this.recoveryMultiplier,
      this.minIntervalMs,
      this.maxIntervalMs
    );
  }

  /**
   * Report downstream overload (e.g. an HTTP 429). Ramps the spacing interval up
   * toward `maxIntervalMs`. If a positive `retryAfterMs` hint is supplied, the next
   * acquisition is delayed by at least that long (capped at `maxCooldownMs`).
   */
  recordBackpressure(retryAfterMs?: number): void {
    this.backpressureEvents += 1;
    this.currentIntervalMs = clamp(
      this.currentIntervalMs * this.backoffMultiplier,
      this.minIntervalMs,
      this.maxIntervalMs
    );
    this.peakIntervalMs = Math.max(this.peakIntervalMs, this.currentIntervalMs);

    if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
      const cooldown = clamp(retryAfterMs, 0, this.maxCooldownMs);
      this.nextAllowedAt = Math.max(this.nextAllowedAt, this.now() + cooldown);
    }
  }

  /** Snapshot of the limiter's lifetime counters and current spacing interval. */
  getStats(): AdaptiveRateLimiterStats {
    return {
      acquisitions: this.acquisitions,
      backpressureEvents: this.backpressureEvents,
      totalWaitMs: this.totalWaitMs,
      peakIntervalMs: this.peakIntervalMs,
      currentIntervalMs: this.currentIntervalMs,
    };
  }

  /** Human-readable label for this limiter (useful in log context). */
  getLabel(): string {
    return this.label;
  }
}
