/**
 * External Service Health Check Service
 *
 * Provides health monitoring for external service integrations:
 * - RSI API
 * - Discord API
 * - Erkul.games API
 * - Regolith API
 */

import axios, { AxiosError } from 'axios';

import { logger } from '../../utils/logger';

import { ComponentHealth, HealthStatus, IHealthCheckable } from './ServiceHealthMonitor';

/**
 * External service configuration
 */
export interface ExternalServiceConfig {
  name: string;
  url: string;
  timeout?: number;
  expectedStatusCodes?: number[];
  headers?: Record<string, string>;
  method?: 'GET' | 'HEAD';
  critical?: boolean;
}

/**
 * External service health details
 */
export interface ExternalServiceHealthDetails {
  url: string;
  statusCode?: number;
  responseTimeMs: number;
  lastSuccessfulCheck?: Date;
  consecutiveFailures: number;
  critical: boolean;
}

/**
 * External Service Health Check Result
 */
export interface ExternalServiceResult {
  name: string;
  health: ComponentHealth;
}

/**
 * External Service Health Check Service
 *
 * Monitors health of external services and APIs
 */
export class ExternalServiceHealthCheckService implements IHealthCheckable {
  private serviceName: string = 'external-services';
  private services: Map<string, ExternalServiceConfig> = new Map();
  private serviceHealth: Map<string, ExternalServiceHealthDetails> = new Map();
  private lastOverallCheck: Date | null = null;

  constructor() {
    // Register default external services
    this.registerDefaultServices();
  }

  /**
   * Register default external services for health monitoring
   */
  private registerDefaultServices(): void {
    // RSI API
    this.registerService({
      name: 'rsi-api',
      url: 'https://robertsspaceindustries.com/api/account/v2/getRoles',
      timeout: 10000,
      expectedStatusCodes: [200, 401, 403], // 401/403 means API is up but auth required
      critical: true,
    });

    // Discord API
    this.registerService({
      name: 'discord-api',
      url: 'https://discord.com/api/v10/gateway',
      timeout: 10000,
      expectedStatusCodes: [200],
      critical: true,
    });

    // Erkul.games API
    this.registerService({
      name: 'erkul-api',
      url: 'https://api.erkul.games/live/ships',
      timeout: 15000,
      expectedStatusCodes: [200],
      critical: false,
    });
  }

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.serviceName;
  }

  /**
   * Register an external service for health monitoring
   */
  registerService(config: ExternalServiceConfig): void {
    this.services.set(config.name, {
      ...config,
      timeout: config.timeout ?? 10000,
      expectedStatusCodes: config.expectedStatusCodes ?? [200],
      method: config.method ?? 'GET',
      critical: config.critical ?? false,
    });

    this.serviceHealth.set(config.name, {
      url: config.url,
      responseTimeMs: 0,
      consecutiveFailures: 0,
      critical: config.critical ?? false,
    });

    logger.info('External service registered for health monitoring', { serviceName: config.name });
  }

  /**
   * Unregister an external service
   */
  unregisterService(name: string): void {
    this.services.delete(name);
    this.serviceHealth.delete(name);
  }

  /**
   * Perform health check on all services
   */
  async healthCheck(): Promise<ComponentHealth> {
    const startTime = Date.now();
    const results = await this.checkAllServices();
    const responseTime = Date.now() - startTime;

    // Aggregate results
    const totalServices = results.length;
    const healthyServices = results.filter(r => r.health.status === HealthStatus.HEALTHY).length;
    const degradedServices = results.filter(r => r.health.status === HealthStatus.DEGRADED).length;
    const unhealthyServices = results.filter(
      r => r.health.status === HealthStatus.UNHEALTHY
    ).length;

    // Check for critical service failures
    const criticalFailures = results.filter(
      r =>
        r.health.status === HealthStatus.UNHEALTHY &&
        (r.health.details as ExternalServiceHealthDetails | undefined)?.critical
    );

    // Determine overall status
    let overallStatus: HealthStatus;
    let message: string;

    if (criticalFailures.length > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
      message = `Critical service(s) down: ${criticalFailures.map(f => f.name).join(', ')}`;
    } else if (unhealthyServices > 0) {
      overallStatus = HealthStatus.DEGRADED;
      message = `${unhealthyServices} of ${totalServices} external services are down`;
    } else if (degradedServices > 0) {
      overallStatus = HealthStatus.DEGRADED;
      message = `${degradedServices} of ${totalServices} external services are degraded`;
    } else if (healthyServices === totalServices) {
      overallStatus = HealthStatus.HEALTHY;
      message = 'All external services healthy';
    } else {
      overallStatus = HealthStatus.UNKNOWN;
      message = 'Unable to determine external service health';
    }

    this.lastOverallCheck = new Date();

    return {
      name: this.serviceName,
      status: overallStatus,
      message,
      responseTime,
      details: {
        services: results.map(r => ({
          name: r.name,
          status: r.health.status,
          responseTime: r.health.responseTime,
          message: r.health.message,
        })),
        summary: {
          total: totalServices,
          healthy: healthyServices,
          degraded: degradedServices,
          unhealthy: unhealthyServices,
        },
      },
      lastCheck: this.lastOverallCheck,
    };
  }

  /**
   * Check all registered services
   */
  async checkAllServices(): Promise<ExternalServiceResult[]> {
    const checks = Array.from(this.services.keys()).map(name => this.checkService(name));
    return Promise.all(checks);
  }

  /**
   * Check a specific service
   */
  async checkService(name: string): Promise<ExternalServiceResult> {
    const config = this.services.get(name);

    if (!config) {
      return {
        name,
        health: {
          name,
          status: HealthStatus.UNKNOWN,
          message: 'Service not registered',
          lastCheck: new Date(),
        },
      };
    }

    const startTime = Date.now();
    let statusCode: number | undefined;
    let error: string | undefined;

    try {
      const response = await axios({
        method: config.method || 'GET',
        url: config.url,
        timeout: config.timeout,
        headers: config.headers,
        validateStatus: () => true, // Accept all status codes
      });

      statusCode = response.status;
      const responseTime = Date.now() - startTime;

      // Update health details
      const healthDetails = this.serviceHealth.get(name);
      if (healthDetails) {
        healthDetails.statusCode = statusCode;
        healthDetails.responseTimeMs = responseTime;
      }

      // Check if status code is expected
      if (config.expectedStatusCodes?.includes(statusCode)) {
        // Reset consecutive failures on success
        if (healthDetails) {
          healthDetails.consecutiveFailures = 0;
          healthDetails.lastSuccessfulCheck = new Date();
        }

        // Determine if healthy or degraded based on response time
        const timeout = config.timeout ?? 10000;
        const status = responseTime < timeout / 2 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;

        return {
          name,
          health: {
            name,
            status,
            message: `Service responding (${statusCode})`,
            responseTime,
            details: healthDetails as Record<string, unknown> | undefined,
            lastCheck: new Date(),
          },
        };
      }

      // Unexpected status code
      if (healthDetails) {
        healthDetails.consecutiveFailures++;
      }

      return {
        name,
        health: {
          name,
          status: HealthStatus.UNHEALTHY,
          message: `Unexpected status code: ${statusCode}`,
          responseTime,
          details: healthDetails as Record<string, unknown> | undefined,
          lastCheck: new Date(),
        },
      };
    } catch (err: unknown) {
      const responseTime = Date.now() - startTime;

      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError;
        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
          error = 'Request timeout';
        } else if (axiosError.code === 'ECONNREFUSED') {
          error = 'Connection refused';
        } else if (axiosError.code === 'ENOTFOUND') {
          error = 'DNS lookup failed';
        } else {
          error = axiosError.message;
        }
      } else if (err instanceof Error) {
        error = err.message;
      } else {
        error = 'Unknown error';
      }

      // Update consecutive failures
      const healthDetails = this.serviceHealth.get(name);
      if (healthDetails) {
        healthDetails.consecutiveFailures++;
        healthDetails.responseTimeMs = responseTime;
      }

      logger.warn('External service health check failed', {
        service: name,
        error,
        consecutiveFailures: healthDetails?.consecutiveFailures,
      });

      return {
        name,
        health: {
          name,
          status: HealthStatus.UNHEALTHY,
          message: error,
          responseTime,
          details: healthDetails as Record<string, unknown> | undefined,
          lastCheck: new Date(),
        },
      };
    }
  }

  /**
   * Get health status for a specific service
   */
  getServiceHealthDetails(name: string): ExternalServiceHealthDetails | undefined {
    return this.serviceHealth.get(name);
  }

  /**
   * Get all registered services
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Check if any critical services are down
   */
  hasCriticalFailures(): boolean {
    for (const [_name, details] of this.serviceHealth.entries()) {
      if (details.critical && details.consecutiveFailures > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get services with consecutive failures
   */
  getFailingServices(): string[] {
    return Array.from(this.serviceHealth.entries())
      .filter(([_, details]) => details.consecutiveFailures > 0)
      .map(([name, _]) => name);
  }
}

// Export singleton instance
export const externalServiceHealthService = new ExternalServiceHealthCheckService();

