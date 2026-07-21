import CircuitBreaker from 'opossum';

import { logger } from '../../utils/logger';

/**
 * Configuration options for a circuit breaker
 */
export interface CircuitBreakerOptions {
  /** Timeout in milliseconds for each action */
  timeout?: number;
  /** Number of times the action can fail before opening the circuit */
  errorThresholdPercentage?: number;
  /** Time in milliseconds before attempting to close the circuit after opening */
  resetTimeout?: number;
  /** Volume threshold - minimum number of requests before the circuit can trip */
  volumeThreshold?: number;
}

/**
 * Statistics returned by circuit breaker
 */
export interface CircuitBreakerStats {
  name: string;
  state: string;
  stats: {
    successes: number;
    failures: number;
    fallbacks: number;
    timeouts: number;
    cacheHits: number;
    fires: number;
    rejects: number;
  };
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // 30 seconds before trying again
  volumeThreshold: 5, // Minimum 5 requests before circuit can trip
};

/**
 * CircuitBreakerService
 *
 * Implements the circuit breaker pattern using Opossum for external API calls.
 * This prevents cascading failures when external services are unavailable.
 *
 * Circuit States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Circuit tripped, requests fail immediately
 * - HALF_OPEN: Testing if service is recovered
 *
 * Usage:
 * ```typescript
 * const breaker = circuitBreakerService.getBreaker('rsi-api', async () => {
 *   return await fetch('https://api.example.com/data');
 * });
 * const result = await breaker.fire();
 * ```
 */
export class CircuitBreakerService {
  private static instance: CircuitBreakerService;
  private readonly breakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  /**
   * Get or create a circuit breaker for a named service
   * @param name Unique name for the circuit breaker
   * @param action The async function to execute
   * @param options Optional configuration overrides
   * @param fallback Optional fallback function when circuit is open
   */
  public getBreaker<T>(
    name: string,
    action: () => Promise<T>,
    options: CircuitBreakerOptions = {},
    fallback?: () => T | Promise<T>
  ): CircuitBreaker<unknown[], T> {
    const existingBreaker = this.breakers.get(name);
    if (existingBreaker) {
      return existingBreaker as CircuitBreaker<unknown[], T>;
    }

    const breakerOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
      name,
    };

    const breaker = new CircuitBreaker(action, breakerOptions);

    // Set up event handlers for logging
    this.setupEventHandlers(breaker, name);

    // Set up fallback if provided
    if (fallback) {
      breaker.fallback(fallback);
    }

    this.breakers.set(name, breaker);
    logger.info(`Circuit breaker created: ${name}`);

    return breaker;
  }

  /**
   * Execute an action through a circuit breaker
   * Creates breaker if it doesn't exist
   */
  public async execute<T>(
    name: string,
    action: () => Promise<T>,
    options: CircuitBreakerOptions = {},
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const breaker = this.getBreaker(name, action, options, fallback);
    return breaker.fire();
  }

  /**
   * Get the state of a circuit breaker
   */
  public getState(name: string): string | null {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return null;
    }

    if (breaker.opened) {
      return 'OPEN';
    }
    if (breaker.halfOpen) {
      return 'HALF_OPEN';
    }
    return 'CLOSED';
  }

  /**
   * Get statistics for a circuit breaker
   */
  public getStats(name: string): CircuitBreakerStats | null {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return null;
    }

    const stats = breaker.stats;
    return {
      name,
      state: this.getState(name) ?? 'UNKNOWN',
      stats: {
        successes: stats.successes,
        failures: stats.failures,
        fallbacks: stats.fallbacks,
        timeouts: stats.timeouts,
        cacheHits: stats.cacheHits,
        fires: stats.fires,
        rejects: stats.rejects,
      },
    };
  }

  /**
   * Get statistics for all circuit breakers
   */
  public getAllStats(): CircuitBreakerStats[] {
    const allStats: CircuitBreakerStats[] = [];
    for (const name of this.breakers.keys()) {
      const stats = this.getStats(name);
      if (stats) {
        allStats.push(stats);
      }
    }
    return allStats;
  }

  /**
   * Reset a circuit breaker
   */
  public reset(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return false;
    }

    breaker.close();
    logger.info(`Circuit breaker reset: ${name}`);
    return true;
  }

  /**
   * Remove a circuit breaker
   */
  public remove(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return false;
    }

    breaker.shutdown();
    this.breakers.delete(name);
    logger.info(`Circuit breaker removed: ${name}`);
    return true;
  }

  /**
   * Clear all circuit breakers
   */
  public clearAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.shutdown();
    }
    this.breakers.clear();
    logger.info('All circuit breakers cleared');
  }

  /**
   * Set up event handlers for logging and monitoring
   */
  private setupEventHandlers(breaker: CircuitBreaker, name: string): void {
    breaker.on('open', () => {
      logger.warn(`Circuit breaker OPENED: ${name}`, {
        circuitBreaker: name,
        event: 'open',
      });
    });

    breaker.on('halfOpen', () => {
      logger.info(`Circuit breaker HALF-OPEN: ${name}`, {
        circuitBreaker: name,
        event: 'halfOpen',
      });
    });

    breaker.on('close', () => {
      logger.info(`Circuit breaker CLOSED: ${name}`, {
        circuitBreaker: name,
        event: 'close',
      });
    });

    breaker.on('fallback', () => {
      logger.info(`Circuit breaker fallback executed: ${name}`, {
        circuitBreaker: name,
        event: 'fallback',
      });
    });

    breaker.on('timeout', () => {
      logger.warn(`Circuit breaker timeout: ${name}`, {
        circuitBreaker: name,
        event: 'timeout',
      });
    });

    breaker.on('reject', () => {
      logger.warn(`Circuit breaker rejected request: ${name}`, {
        circuitBreaker: name,
        event: 'reject',
      });
    });
  }

  /**
   * Check if circuit is healthy (closed or half-open)
   * Returns false for non-existent breakers to flag configuration issues
   */
  public isHealthy(name: string): boolean {
    const state = this.getState(name);
    // Non-existent breakers are considered unhealthy (configuration issue)
    if (state === null) {
      return false;
    }
    return state !== 'OPEN';
  }

  /**
   * Get health status for all circuit breakers
   */
  public getHealthStatus(): { healthy: boolean; unhealthyCircuits: string[] } {
    const unhealthyCircuits: string[] = [];

    for (const name of this.breakers.keys()) {
      if (!this.isHealthy(name)) {
        unhealthyCircuits.push(name);
      }
    }

    return {
      healthy: unhealthyCircuits.length === 0,
      unhealthyCircuits,
    };
  }
}

// Export singleton instance
export const circuitBreakerService = CircuitBreakerService.getInstance();

