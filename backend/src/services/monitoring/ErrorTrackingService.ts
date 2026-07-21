/**
 * Centralized Error Tracking Service
 *
 * Provides comprehensive error tracking and monitoring capabilities:
 * - Captures unhandled errors and promise rejections
 * - Enriches errors with contextual information (user, org, route, etc.)
 * - Integrates with Azure Application Insights
 * - Supports error aggregation and analysis
 */

import { Request } from 'express';

import { getAppInsightsClient } from '../../config/applicationInsights';
import { getBreadcrumbs, getCorrelationData } from '../../middleware/requestCorrelation';
import { logger } from '../../utils/logger';
import { sanitizeObject, sanitizeQueryParams } from '../../utils/securityUtils';

// SeverityLevel is a string type in newer Application Insights SDK versions
type AppInsightsSeverityLevel = string;

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  Verbose = 0,
  Information = 1,
  Warning = 2,
  Error = 3,
  Critical = 4,
}

/**
 * Error context information
 */
export interface ErrorContext {
  userId?: string;
  organizationId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
  requestDuration?: number;
  breadcrumbs?: unknown[];
  queryParams?: Record<string, unknown>;
  requestSize?: number;
  additionalData?: Record<string, unknown>;
}

/**
 * Error tracking options
 */
export interface ErrorTrackingOptions {
  severity?: ErrorSeverity;
  context?: ErrorContext;
  tags?: Record<string, string>;
  metrics?: Record<string, number>;
}

/**
 * Centralized Error Tracking Service
 */
export class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  /**
   * Initialize error tracking service and global handlers
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.warn('ErrorTrackingService already initialized');
      return;
    }

    this.setupGlobalErrorHandlers();
    this.isInitialized = true;
    logger.info('ErrorTrackingService initialized successfully');
  }

  /**
   * Track an error with context
   */
  public trackError(error: Error, options: ErrorTrackingOptions = {}): void {
    const { severity = ErrorSeverity.Error, context, tags, metrics } = options;

    // Build properties for Application Insights
    const properties: Record<string, string> = {
      errorName: error.name,
      errorMessage: error.message,
      severity: ErrorSeverity[severity],
      timestamp: new Date().toISOString(),
      ...this.buildContextProperties(context),
      ...tags,
    };

    // Add stack trace if available
    if (error.stack) {
      properties.stackTrace = error.stack;
    }

    const sanitizedProperties = sanitizeObject(properties);
    const telemetryProperties = this.toTelemetryProperties(sanitizedProperties);

    // Log to Winston logger
    logger.error('Error tracked', {
      error: error.message,
      stack: error.stack,
      ...sanitizedProperties,
    });

    // Send to Application Insights
    const client = getAppInsightsClient();
    if (client) {
      client.trackException({
        exception: error,
        properties: telemetryProperties,
        measurements: metrics,
        severity: severity as unknown as AppInsightsSeverityLevel,
      });

      // Flush immediately for critical errors
      if (severity === ErrorSeverity.Critical) {
        void client.flush();
      }
    }
  }

  /**
   * Track an error from an Express request
   */
  public trackRequestError(
    error: Error,
    req: Request,
    options: Partial<ErrorTrackingOptions> = {}
  ): void {
    const context = this.extractRequestContext(req);

    this.trackError(error, {
      ...options,
      context: {
        ...context,
        ...options.context,
      },
    });
  }

  /**
   * Track an async error (from promise rejection)
   */
  public trackAsyncError(error: Error | unknown, context?: ErrorContext): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    this.trackError(errorObj, {
      severity: ErrorSeverity.Error,
      context,
      tags: {
        errorType: 'unhandledRejection',
      },
    });
  }

  /**
   * Track a critical error
   */
  public trackCriticalError(error: Error, context?: ErrorContext): void {
    this.trackError(error, {
      severity: ErrorSeverity.Critical,
      context,
    });
  }

  /**
   * Extract error context from Express request
   */
  private extractRequestContext(req: Request): ErrorContext {
    const correlationData = getCorrelationData(req);
    const breadcrumbs = getBreadcrumbs(req);

    // Safely extract query params, sanitizing sensitive data
    const queryParams = sanitizeQueryParams(req.query);

    // Calculate request size if available
    const requestSize = req.headers['content-length']
      ? parseInt(req.headers['content-length'], 10)
      : undefined;

    return {
      userId: (req as unknown as Record<string, unknown>).user
        ? (((req as unknown as Record<string, unknown>).user as Record<string, unknown>)
            ?.id as string)
        : ((req as unknown as Record<string, unknown>).userId as string),
      organizationId:
        ((req as unknown as Record<string, unknown>).organizationId as string) ||
        (((req as unknown as Record<string, unknown>).org as Record<string, unknown>)
          ?.id as string),
      route: req.route?.path || req.path,
      method: req.method,
      requestId: correlationData.requestId,
      correlationId: correlationData.correlationId,
      requestDuration: correlationData.duration,
      userAgent: req.headers?.['user-agent'],
      ipAddress: req.ip || req.socket?.remoteAddress,
      breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : undefined,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      requestSize,
    };
  }

  /**
   * Build properties object from error context
   */
  private buildContextProperties(context?: ErrorContext): Record<string, string> {
    if (!context) {
      return {};
    }

    const properties: Record<string, string> = {};

    if (context.userId) {
      properties.userId = context.userId;
    }
    if (context.organizationId) {
      properties.organizationId = context.organizationId;
    }
    if (context.route) {
      properties.route = context.route;
    }
    if (context.method) {
      properties.method = context.method;
    }
    if (context.statusCode) {
      properties.statusCode = String(context.statusCode);
    }
    if (context.requestId) {
      properties.requestId = context.requestId;
    }
    if (context.correlationId) {
      properties.correlationId = context.correlationId;
    }
    if (context.userAgent) {
      properties.userAgent = context.userAgent;
    }
    if (context.ipAddress) {
      properties.ipAddress = context.ipAddress;
    }
    if (context.requestDuration) {
      properties.requestDuration = String(context.requestDuration);
    }
    if (context.requestSize) {
      properties.requestSize = String(context.requestSize);
    }

    // Add breadcrumbs as JSON string if provided
    if (context.breadcrumbs && context.breadcrumbs.length > 0) {
      try {
        properties.breadcrumbs = JSON.stringify(context.breadcrumbs);
      } catch (err: unknown) {
        logger.warn('Failed to stringify breadcrumbs', { err });
      }
    }

    // Add query params as JSON string if provided
    if (context.queryParams) {
      try {
        properties.queryParams = JSON.stringify(sanitizeQueryParams(context.queryParams));
      } catch (err: unknown) {
        logger.warn('Failed to stringify query params', { err });
      }
    }

    // Add additional data as JSON string if provided
    if (context.additionalData) {
      try {
        properties.additionalData = JSON.stringify(sanitizeObject(context.additionalData));
      } catch (err: unknown) {
        logger.warn('Failed to stringify additional error data', { err });
      }
    }

    return properties;
  }

  private toTelemetryProperties(properties: Record<string, unknown>): Record<string, string> {
    const telemetryProperties: Record<string, string> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === 'string') {
        telemetryProperties[key] = value;
        continue;
      }

      try {
        telemetryProperties[key] = JSON.stringify(value);
      } catch {
        telemetryProperties[key] = '[Unserializable value]';
      }
    }

    return telemetryProperties;
  }

  /**
   * Set up global error handlers for uncaught exceptions and unhandled rejections
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception detected', {
        error: error.message,
        stack: error.stack,
      });

      this.trackError(error, {
        severity: ErrorSeverity.Critical,
        tags: {
          errorType: 'uncaughtException',
        },
      });

      // Give Application Insights time to send data before exiting
      const client = getAppInsightsClient();
      if (client) {
        void client.flush();
        // Wait a moment then exit
        setTimeout(() => {
          logger.error('Process will exit due to uncaught exception');
          process.exit(1);
        }, 1000);
      } else {
        logger.error('Process will exit due to uncaught exception');
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));

      // Filter out Application Insights quota exceeded errors
      // These are expected when daily quota is reached and should not be treated as critical errors
      const errorMessage = error.message || String(reason);
      const isQuotaError =
        errorMessage.includes('Daily quota exceeded') ||
        errorMessage.includes('PeriodicExportingMetricReader') ||
        (reason as Record<string, unknown>)?.statusCode === 439;

      if (isQuotaError) {
        // Log as warning only, don't track as error
        logger.warn('Application Insights quota exceeded - telemetry export throttled', {
          message: errorMessage,
          statusCode: (reason as Record<string, unknown>)?.statusCode || 439,
        });
        return; // Don't track this as an error
      }

      logger.error('Unhandled Promise Rejection detected', {
        error: error.message,
        stack: error.stack,
        reason: String(reason),
      });

      this.trackError(error, {
        severity: ErrorSeverity.Error,
        tags: {
          errorType: 'unhandledRejection',
        },
      });
    });

    // Handle warning events (optional)
    process.on('warning', (warning: Error) => {
      logger.warn('Node.js warning detected', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      });

      // Track as low severity for monitoring
      this.trackError(warning, {
        severity: ErrorSeverity.Warning,
        tags: {
          errorType: 'nodeWarning',
        },
      });
    });
  }
}

// Export singleton instance
export const errorTrackingService = ErrorTrackingService.getInstance();

