/**
 * Resilience Domain Services
 * Circuit breakers, retry logic, and HTTP client management for external API resilience
 */

export { CircuitBreakerService, circuitBreakerService } from './CircuitBreakerService';
export type { CircuitBreakerOptions, CircuitBreakerStats } from './CircuitBreakerService';

export { HttpClientManager, httpClientManager, clientConfigs } from './HttpClientManager';
export type { HttpClientConfig } from './HttpClientManager';

