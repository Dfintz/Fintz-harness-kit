import { logger } from '@/utils/logger';
import { apiClient } from './apiClient';
/**
 * Frontend Error Tracking Service
 *
 * Provides comprehensive error tracking and monitoring for the frontend:
 * - Captures unhandled errors and promise rejections
 * - Enriches errors with contextual information (user, org, page/route, browser info)
 * - Sends errors to backend for Application Insights integration
 * - Supports error aggregation and analysis
 */

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
  page?: string;
  route?: string;
  component?: string;
  userAgent?: string;
  browserInfo?: BrowserInfo;
  screenResolution?: string;
  additionalData?: Record<string, unknown>;
}

/**
 * Browser information
 */
export interface BrowserInfo {
  name: string;
  version: string;
  os: string;
  platform: string;
}

/**
 * Error tracking options
 */
export interface ErrorTrackingOptions {
  severity?: ErrorSeverity;
  context?: ErrorContext;
  tags?: Record<string, string>;
}

/**
 * Error report payload
 */
interface ErrorReport {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  severity: ErrorSeverity;
  context: ErrorContext;
  timestamp: string;
  tags?: Record<string, string>;
}

/**
 * Frontend Error Tracking Service
 */
export class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private isInitialized = false;
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 100;

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
      // Only log in development - already initialized is not an error
      if (import.meta.env.DEV) {
        logger.warn('ErrorTrackingService already initialized');
      }
      return;
    }

    this.setupGlobalErrorHandlers();
    this.isInitialized = true;

    // Log initialization success only in development
    if (import.meta.env.DEV) {
      logger.info('ErrorTrackingService initialized successfully');
    }
  }

  /**
   * Track an error with context
   */
  public trackError(error: Error, options: ErrorTrackingOptions = {}): void {
    const { severity = ErrorSeverity.Error, context, tags } = options;

    // Build error report
    const errorReport: ErrorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      severity,
      context: {
        ...this.getBrowserContext(),
        ...context,
      },
      timestamp: new Date().toISOString(),
      tags,
    };

    // Add to queue
    this.addToQueue(errorReport);

    // Send to backend
    this.sendErrorToBackend(errorReport);
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
   * Track an async error (from promise rejection)
   */
  public trackAsyncError(error: unknown, context?: ErrorContext): void {
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
   * Track a React component error
   */
  public trackComponentError(error: Error, componentStack: string, componentName?: string): void {
    this.trackError(error, {
      severity: ErrorSeverity.Error,
      context: {
        component: componentName,
        additionalData: {
          componentStack,
        },
      },
      tags: {
        errorType: 'reactComponent',
      },
    });
  }

  /**
   * Get browser context information
   */
  private getBrowserContext(): ErrorContext {
    // Check if running in browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {};
    }

    const browserInfo = this.detectBrowser();

    // Safely access window properties that might not be available in test environment
    let page: string | undefined;
    let route: string | undefined;
    let screenResolution: string | undefined;

    try {
      page = window.location?.pathname;
      route = window.location ? window.location.pathname + window.location.search : undefined;
      screenResolution = window.screen
        ? `${window.screen.width}x${window.screen.height}`
        : undefined;
    } catch (error) {
      // Silently fail if properties are not accessible (e.g., in test environment)
    }

    return {
      page,
      route,
      userAgent: navigator.userAgent,
      browserInfo,
      screenResolution,
    };
  }

  /**
   * Detect browser information
   */
  private detectBrowser(): BrowserInfo {
    // Return defaults if not in browser environment
    if (typeof navigator === 'undefined') {
      return {
        name: 'Unknown',
        version: 'Unknown',
        os: 'Unknown',
        platform: 'Unknown',
      };
    }

    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    let os = 'Unknown';

    // Detect browser
    if (userAgent.includes('Firefox/')) {
      browserName = 'Firefox';
      browserVersion = userAgent.split('Firefox/')[1]?.split(' ')[0] || 'Unknown';
    } else if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) {
      browserName = 'Chrome';
      browserVersion = userAgent.split('Chrome/')[1]?.split(' ')[0] || 'Unknown';
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
      browserName = 'Safari';
      browserVersion = userAgent.split('Version/')[1]?.split(' ')[0] || 'Unknown';
    } else if (userAgent.includes('Edg/')) {
      browserName = 'Edge';
      browserVersion = userAgent.split('Edg/')[1]?.split(' ')[0] || 'Unknown';
    }

    // Detect OS
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
    } else if (
      userAgent.includes('iOS') ||
      userAgent.includes('iPhone') ||
      userAgent.includes('iPad')
    ) {
      os = 'iOS';
    }

    return {
      name: browserName,
      version: browserVersion,
      os,
      platform: navigator.platform,
    };
  }

  /**
   * Add error report to queue
   */
  private addToQueue(errorReport: ErrorReport): void {
    this.errorQueue.push(errorReport);

    // Keep queue size under limit
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  /**
   * Get queued errors (for debugging)
   */
  public getQueuedErrors(): ErrorReport[] {
    return [...this.errorQueue];
  }

  /**
   * Map numeric ErrorSeverity enum to string values expected by the backend API
   */
  private mapSeverityToString(severity: ErrorSeverity): string {
    const severityMap: Record<ErrorSeverity, string> = {
      [ErrorSeverity.Verbose]: 'info',
      [ErrorSeverity.Information]: 'info',
      [ErrorSeverity.Warning]: 'warning',
      [ErrorSeverity.Error]: 'error',
      [ErrorSeverity.Critical]: 'critical',
    };
    return severityMap[severity] || 'error';
  }

  /**
   * Send error to backend API
   * Uses apiClient which automatically injects CSRF token and credentials.
   */
  private async sendErrorToBackend(errorReport: ErrorReport): Promise<void> {
    try {
      // Convert numeric severity to string for backend Joi validation
      const payload = {
        ...errorReport,
        severity: this.mapSeverityToString(errorReport.severity),
      };

      await apiClient.postRaw('/api/v2/errors/track', payload);
    } catch (error) {
      // Silently fail - don't create infinite error loop
      if (import.meta.env.DEV) {
        logger.warn('Failed to send error to backend:', error);
      }
    }
  }

  /**
   * Set up global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Only set up handlers in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    // Handle uncaught errors
    window.addEventListener('error', (event: ErrorEvent) => {
      const error = event.error || new Error(event.message);

      this.trackError(error, {
        severity: ErrorSeverity.Error,
        context: {
          additionalData: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        },
        tags: {
          errorType: 'uncaughtError',
        },
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

      this.trackAsyncError(error);
    });
  }
}

// Export singleton instance
export const errorTrackingService = ErrorTrackingService.getInstance();
