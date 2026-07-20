/**
 * Frontend Logger Utility
 *
 * Provides a centralized logging service for the frontend that:
 * - Uses error tracking service for errors
 * - Suppresses logs in production
 * - Provides structured logging in development
 * - Integrates with backend Application Insights via error tracking
 */

// IMPORTANT: Do NOT import errorTrackingService at the top level.
// errorTracking.ts imports logger.ts, so a top-level import here creates
// a circular dependency that can cause TDZ errors in bundled output.
// Instead, we lazily import it when first needed (see getErrorTracking()).

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
}

/**
 * Frontend Logger class
 */
class Logger {
  private config: LoggerConfig;
  private _errorTracking: typeof import('@/services/errorTracking') | null = null;

  constructor() {
    // In production, suppress all console logs except errors (which go to error tracking)
    // In development, allow all logs
    this.config = {
      minLevel: import.meta.env.PROD ? LogLevel.ERROR : LogLevel.DEBUG,
      enableConsole: import.meta.env.DEV,
    };
  }

  /**
   * Lazy accessor for errorTrackingService — avoids circular import TDZ.
   * Uses synchronous require() to load the module on first access.
   * Block-level eslint-disable is needed because the statement spans multiple lines.
   */
  private getErrorTracking() {
    this._errorTracking ??=
      require('@/services/errorTracking') as typeof import('@/services/errorTracking');

    return this._errorTracking;
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Log info message (development only)
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${message}`, ...args);

      // Track warnings in error tracking (low severity)
      if (import.meta.env.PROD) {
        const tracking = this.getErrorTracking();
        if (tracking) {
          tracking.errorTrackingService.trackError(new Error(message), {
            severity: tracking.ErrorSeverity.Warning,
            context: {
              additionalData: { args },
            },
          });
        }
      }
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: unknown, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${message}`, error, ...args);

      // Always track errors in error tracking service
      const errorObj = error instanceof Error ? error : new Error(message);
      const tracking = this.getErrorTracking();
      if (tracking) {
        tracking.errorTrackingService.trackError(errorObj, {
          severity: tracking.ErrorSeverity.Error,
          context: {
            additionalData: { message, args },
          },
        });
      }
    }
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minLevelIndex = levels.indexOf(this.config.minLevel);
    const currentLevelIndex = levels.indexOf(level);

    return currentLevelIndex >= minLevelIndex && this.config.enableConsole;
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
