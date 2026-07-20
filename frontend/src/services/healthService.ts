/**
 * Health Check Service
 * Provides functionality to check backend server availability
 */

import { getBackendUrl } from '@/config/env';
import { ApiClient, apiClient, isApiClientError } from './apiClient';

export interface HealthCheckResult {
  isHealthy: boolean;
  backendUrl: string;
  error?: string;
}

/**
 * Check if the backend server is available and responding
 *
 * @param timeout - Request timeout in milliseconds (default: 5000)
 * @returns Promise<HealthCheckResult> with health status
 */
export async function checkBackendHealth(timeout: number = 5000): Promise<HealthCheckResult> {
  const backendUrl = getBackendUrl();

  try {
    // Probe the bare /health endpoint (plain JSON, no ApiResponse envelope).
    // apiClient handles baseURL resolution consistently with the rest of the app.
    // Skip retry so callers get a single bounded probe rather than 3 retried attempts.
    await apiClient.getRaw<unknown>(
      '/health',
      ApiClient.skipRetry({
        timeout,
        // Don't send credentials for health check
        withCredentials: false,
      })
    );

    return {
      isHealthy: true,
      backendUrl,
    };
  } catch (error) {
    if (isApiClientError(error)) {
      // statusCode 0 indicates network failure / timeout (no response)
      if (error.statusCode === 0) {
        return {
          isHealthy: false,
          backendUrl,
          error: error.message.includes('timeout')
            ? `Backend health check timed out after ${timeout}ms`
            : 'Cannot connect to backend server - server may not be running',
        };
      }

      // Backend responded but with error status
      return {
        isHealthy: false,
        backendUrl,
        error: `Backend returned status ${error.statusCode}`,
      };
    }

    if (error instanceof Error) {
      return {
        isHealthy: false,
        backendUrl,
        error: error.message,
      };
    }

    return {
      isHealthy: false,
      backendUrl,
      error: 'Unknown error checking backend health',
    };
  }
}

/**
 * Continuously check backend health with a callback
 * Useful for monitoring backend availability in real-time
 *
 * Default interval is 30 seconds which is suitable for most use cases:
 * - Frequent enough to detect issues within reasonable time
 * - Infrequent enough to avoid unnecessary network traffic
 * - Aligns with typical health check intervals in production systems
 *
 * For more responsive monitoring (e.g., during development), use a shorter interval.
 * For less critical monitoring, use a longer interval to reduce network overhead.
 *
 * @param onHealthChange - Callback function called when health status changes
 * @param intervalMs - Check interval in milliseconds (default: 30000 = 30 seconds)
 * @returns Function to stop the health monitoring
 */
export function monitorBackendHealth(
  onHealthChange: (result: HealthCheckResult) => void,
  intervalMs: number = 30000
): () => void {
  let lastHealthy: boolean | null = null;

  const checkHealth = async () => {
    const result = await checkBackendHealth();

    // Only call callback if health status changed
    if (lastHealthy === null || lastHealthy !== result.isHealthy) {
      lastHealthy = result.isHealthy;
      onHealthChange(result);
    }
  };

  // Check immediately
  checkHealth();

  // Then check periodically
  const intervalId = setInterval(checkHealth, intervalMs);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
}
