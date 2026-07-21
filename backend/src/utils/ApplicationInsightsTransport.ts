import * as appInsights from 'applicationinsights';
import Transport from 'winston-transport';

import { sanitizeObject } from './securityUtils';

/**
 * Application Insights Transport for Winston Logger
 *
 * This transport sends all Winston logs to Azure Application Insights
 * for centralized monitoring, analytics, and alerting.
 */
export class ApplicationInsightsTransport extends Transport {
  private readonly client: appInsights.TelemetryClient | undefined;

  constructor(options?: Transport.TransportStreamOptions) {
    super(options);
    this.client = appInsights.defaultClient;
  }

  override log(info: Record<string, unknown>, callback: () => void): void {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (!this.client) {
      callback();
      return;
    }

    const { level, message, timestamp, ...metadata } = info;
    const lvl = level as string;
    const ts = timestamp as string | undefined;

    try {
      // Map Winston log levels to Application Insights severity levels
      const severityLevel = this.mapSeverityLevel(lvl);
      const sanitizedMetadata = this.sanitizeMetadata(metadata);

      // Build properties object for Application Insights
      const properties: Record<string, string> = {
        service: 'sc-fleet-manager',
        level: lvl,
        timestamp: ts || new Date().toISOString(),
      };

      // Add metadata properties
      Object.entries(sanitizedMetadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          properties[key] = this.toPropertyValue(value);
        }
      });

      // Track different log types
      if (lvl === 'error' && info instanceof Error) {
        // Track exceptions for errors
        this.client.trackException({
          exception: info,
          properties,
          severity: severityLevel,
        });
      } else {
        // Track as custom trace
        this.client.trackTrace({
          message: String(message),
          severity: severityLevel,
          properties,
        });
      }

      // Flush immediately for critical errors
      if (lvl === 'error' || lvl === 'fatal') {
        void this.client.flush();
      }
    } catch (error) {
      // Silently fail to avoid breaking logging
      console.error('Error sending log to Application Insights:', error);
    }

    callback();
  }

  private mapSeverityLevel(level: string): string {
    const Severity = {
      Verbose: 'Verbose',
      Information: 'Information',
      Warning: 'Warning',
      Error: 'Error',
      Critical: 'Critical',
    } as const;
    switch (level) {
      case 'error':
        return Severity.Error;
      case 'warn':
        return Severity.Warning;
      case 'debug':
        return Severity.Verbose;
      case 'info':
      default:
        return Severity.Information;
    }
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      try {
        const entry = sanitizeObject({ [key]: value });
        sanitized[key] = entry[key];
      } catch {
        sanitized[key] = '[Unserializable metadata]';
      }
    }

    return sanitized;
  }

  private toPropertyValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Unserializable metadata]';
      }
    }

    return '[Unsupported metadata type]';
  }
}
