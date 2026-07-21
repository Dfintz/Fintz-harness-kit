import * as appInsights from 'applicationinsights';
import { NextFunction, Request, Response } from 'express';

import { logger } from '../utils/logger';

/**
 * Initialize Azure Application Insights for telemetry collection
 *
 * This module sets up Application Insights to automatically track:
 * - HTTP requests and responses
 * - Dependencies (database, Redis, external APIs)
 * - Exceptions and errors
 * - Custom events and metrics
 * - Performance counters
 *
 * Must be called BEFORE any other imports to properly instrument the application.
 *
 * Note: Uses Application Insights SDK 3.x (OpenTelemetry-based)
 */
export function initializeApplicationInsights(): void {
  const instrumentationKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY;
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  // Only initialize if instrumentation key or connection string is provided
  if (!instrumentationKey && !connectionString) {
    logger.info('Application Insights not configured - telemetry collection disabled');
    return;
  }

  try {
    // Setup Application Insights with connection string (preferred) or instrumentation key (legacy)
    if (connectionString) {
      appInsights
        .setup(connectionString)
        .setAutoCollectConsole(false, false) // Disable console log collection to reduce quota usage
        .setAutoCollectExceptions(true) // Capture uncaught exceptions
        .setAutoCollectPerformance(false, false) // DISABLED: metrics causing quota issues
        .setAutoCollectRequests(true) // Capture HTTP requests
        .setAutoCollectDependencies(false) // DISABLED: to reduce quota usage
        .setAutoCollectIncomingRequestAzureFunctions(false) // DISABLED: not used
        .setSendLiveMetrics(false); // Disable live metrics to reduce quota usage
    } else if (instrumentationKey) {
      appInsights
        .setup(instrumentationKey)
        .setAutoCollectConsole(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectRequests(true)
        .setAutoCollectDependencies(true)
        .setSendLiveMetrics(true);
    }

    // Configure sampling before starting (SDK 3.x requires configuration before start())
    const defaultSampling = process.env.NODE_ENV === 'production' ? 5 : 100;
    const samplingPercentage = process.env.APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE
      ? parseInt(process.env.APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE, 10)
      : defaultSampling;

    // Validate and set sampling percentage
    if (!isNaN(samplingPercentage) && samplingPercentage >= 1 && samplingPercentage <= 100) {
      appInsights.defaultClient.config.samplingPercentage = samplingPercentage;
    } else {
      logger.warn('Invalid APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE, using default', {
        provided: samplingPercentage,
        default: defaultSampling,
      });
      appInsights.defaultClient.config.samplingPercentage = defaultSampling;
    }

    // Start the Application Insights client
    // Note: In SDK 3.x, configuration must be done before calling start()
    // Auto-collection is enabled by default in SDK 3.x
    appInsights.start();

    // Configure additional settings after start (for properties that can be set post-start)
    const client = appInsights.defaultClient;
    if (client) {
      // Add application version
      const version = process.env.APP_VERSION || 'unknown';
      client.context.tags[client.context.keys.applicationVersion] = version;

      // Add custom cloud role
      client.context.tags[client.context.keys.cloudRole] = 'sc-fleet-manager-backend';
      client.context.tags[client.context.keys.cloudRoleInstance] =
        process.env.HOSTNAME || 'unknown';
    }

    logger.info('Application Insights initialized successfully', {
      instrumentationKey: instrumentationKey
        ? `${instrumentationKey.substring(0, 8)}...`
        : undefined,
      connectionString: connectionString ? 'configured' : undefined,
      version: '3.x (OpenTelemetry-based)',
      autoCollect: 'exceptions and requests only',
      samplingPercentage: client?.config.samplingPercentage || 'disabled',
    });
  } catch (error) {
    logger.error('Failed to initialize Application Insights', { error });
  }
}

/**
 * Get the Application Insights client for custom telemetry
 *
 * @returns TelemetryClient instance or undefined if not initialized
 */
export function getAppInsightsClient(): appInsights.TelemetryClient | undefined {
  return appInsights.defaultClient;
}

/**
 * Track a custom event
 *
 * @param name - Event name
 * @param properties - Event properties
 */
export function trackEvent(name: string, properties?: Record<string, string>): void {
  const client = getAppInsightsClient();
  if (client) {
    client.trackEvent({ name, properties });
  }
}

/**
 * Track a custom metric
 *
 * @param name - Metric name
 * @param value - Metric value
 */
export function trackMetric(name: string, value: number): void {
  const client = getAppInsightsClient();
  if (client) {
    client.trackMetric({ name, value });
  }
}

/**
 * Track an exception
 *
 * @param exception - Error object
 * @param properties - Additional properties
 */
export function trackException(exception: Error, properties?: Record<string, string>): void {
  const client = getAppInsightsClient();
  if (client) {
    client.trackException({ exception, properties });
  }
}

/**
 * Application Insights severity levels
 */
export type SeverityLevel = 'Verbose' | 'Information' | 'Warning' | 'Error' | 'Critical';

/**
 * Track a trace/log message
 *
 * @param message - Log message
 * @param severity - Severity level ('Verbose', 'Information', 'Warning', 'Error', 'Critical')
 * @param properties - Additional properties
 */
export function trackTrace(
  message: string,
  severity?: SeverityLevel,
  properties?: Record<string, string>
): void {
  const client = getAppInsightsClient();
  if (client) {
    client.trackTrace({ message, severity, properties });
  }
}

/**
 * Express middleware for tracking performance and errors
 *
 * This middleware tracks:
 * - Request start/end times
 * - Response status codes
 * - Errors and exceptions
 * - Request size and response time
 *
 * @returns Express middleware function
 */
export function applicationInsightsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const client = getAppInsightsClient();

    // Track request details
    const originalSend = res.send;
    res.send = function (data: unknown) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Track performance metrics
      if (client) {
        // Track request completion time
        trackMetric('http_request_duration_ms', duration);

        // Track by status code
        const _statusRange = Math.floor(statusCode / 100) * 100;
        trackEvent('http_request_completed', {
          method: req.method,
          path: req.route?.path || req.path,
          statusCode: String(statusCode),
          duration: String(duration),
        });

        // Track error responses
        if (statusCode >= 400) {
          trackEvent('http_error_response', {
            method: req.method,
            path: req.route?.path || req.path,
            statusCode: String(statusCode),
            duration: String(duration),
          });
        }
      }

      // Call original send method
      return originalSend.call(this, data);
    };

    // Handle errors
    const originalJson = res.json;
    res.json = function (data: unknown) {
      const duration = Date.now() - startTime;

      // Track if this is an error response
      if (res.statusCode >= 400 && client) {
        const properties: Record<string, string> = {
          method: req.method,
          path: req.route?.path || req.path,
          statusCode: String(res.statusCode),
          duration: String(duration),
        };

        // Add error details if present
        const errorData = data as
          | { error?: string | { message?: string; code?: string } }
          | undefined;
        if (errorData?.error) {
          properties.error =
            typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
        }

        if (res.statusCode >= 500) {
          trackEvent('http_server_error', properties);
        } else if (res.statusCode >= 400) {
          trackEvent('http_client_error', properties);
        }
      }

      return originalJson.call(this, data);
    };

    next();
  };
}
