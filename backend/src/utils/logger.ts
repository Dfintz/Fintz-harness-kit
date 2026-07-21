import fs from 'node:fs';
import path from 'node:path';

import winston from 'winston';

import { ApplicationInsightsTransport } from './ApplicationInsightsTransport';
import { AzureBlobLogTransport } from './AzureBlobLogTransport';
import { redactionFormat } from './logRedaction';
import { requestContextStorage } from './requestContext';

/**
 * Custom Winston format that auto-injects correlation IDs from AsyncLocalStorage.
 * When a request context is active, every log entry gets requestId and correlationId
 * without the caller having to pass them explicitly.
 */
const correlationFormat = winston.format(info => {
  const ctx = requestContextStorage.getStore();
  if (ctx) {
    info.requestId = info.requestId || ctx.requestId;
    info.correlationId = info.correlationId || ctx.correlationId;
    if (ctx.userId) {
      info.userId = info.userId || ctx.userId;
    }
  }
  return info;
});

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  correlationFormat(),
  winston.format.splat(),
  // Defense-in-depth: redact secret-bearing metadata before serialization so it
  // never reaches any transport (Console stdout, File, Azure Blob). Runs after
  // splat() so splat-merged metadata is also covered. (SEC-04 / A4)
  redactionFormat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  redactionFormat(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Create logs directory path
const logsDir = path.join(process.cwd(), 'logs');

// Check if we can write to logs directory
let canWriteLogs = false;
try {
  // Try to create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  // Test write permissions
  fs.accessSync(logsDir, fs.constants.W_OK);
  canWriteLogs = true;
} catch (error: unknown) {
  // NOSONAR - intentionally handled: filesystem logging is optional
  // If we can't write logs to filesystem, it's not critical in production
  // We'll use Azure Blob Storage or console transport instead
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `Unable to create or write to logs directory: ${logsDir}. File logging will be disabled.`,
      error instanceof Error ? error.message : String(error)
    );
  }
  canWriteLogs = false;
}

// Configure winston logger with appropriate transports
const transports: winston.transport[] = [];

// Always add Application Insights transport if configured
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  try {
    transports.push(
      new ApplicationInsightsTransport({
        level: process.env.LOG_LEVEL || 'info',
      })
    );
    console.log('✅ Application Insights logging enabled');
  } catch (error) {
    console.warn(
      '⚠️  Failed to initialize Application Insights logging:',
      (error as Error).message
    );
  }
}

// In production, prefer Azure Blob Storage for logs
if (process.env.NODE_ENV === 'production') {
  // Try to set up Azure Blob Storage transport
  const azureStorageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const azureStorageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;

  if (azureStorageConnectionString || azureStorageAccountName) {
    try {
      transports.push(
        new AzureBlobLogTransport({
          level: 'info',
          containerName: 'logs',
          connectionString: azureStorageConnectionString,
          storageAccountName: azureStorageAccountName,
        })
      );
      console.log('✅ Azure Blob Storage logging enabled');
    } catch (error) {
      console.warn(
        '⚠️  Failed to initialize Azure Blob Storage logging:',
        (error as Error).message
      );
    }
  }
}

// Add local file transports if we can write logs (typically for development)
if (canWriteLogs && process.env.NODE_ENV !== 'production') {
  transports.push(
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Always add console transport (essential for container environments)
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'sc-fleet-manager' },
  transports,
});

// Suppress console logs in test environment
if (process.env.NODE_ENV === 'test') {
  logger.transports.forEach(transport => {
    transport.silent = true;
  });
}
