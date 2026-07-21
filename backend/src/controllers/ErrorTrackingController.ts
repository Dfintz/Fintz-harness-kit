/**
 * Error Tracking Controller
 * 
 * Handles frontend error reports and tracks them via Application Insights
 */

import { Request, Response } from 'express';

import { errorTrackingService, ErrorSeverity } from '../services/monitoring/ErrorTrackingService';
import { logger } from '../utils/logger';

/**
 * Frontend error report payload
 */
interface FrontendErrorReport {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  severity: ErrorSeverity;
  context: {
    userId?: string;
    organizationId?: string;
    page?: string;
    route?: string;
    component?: string;
    userAgent?: string;
    browserInfo?: {
      name: string;
      version: string;
      os: string;
      platform: string;
    };
    screenResolution?: string;
    additionalData?: Record<string, unknown>;
  };
  timestamp: string;
  tags?: Record<string, string>;
}

/**
 * Track error from frontend
 */
export const trackFrontendError = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const errorReport: FrontendErrorReport = req.body;

    // Validate payload
    if (!errorReport.error?.message) {
      res.status(400).json({ error: 'Invalid error report payload' });
      return;
    }

    // Reconstruct error object
    const error = new Error(errorReport.error.message);
    error.name = errorReport.error.name || 'FrontendError';
    error.stack = errorReport.error.stack;

    // Enrich context with server-side information
    const enrichedContext = {
      ...errorReport.context,
      userId: errorReport.context.userId || (req as Request & { user?: { id?: string } }).user?.id,
      organizationId: errorReport.context.organizationId || (req as Request & { organizationId?: string }).organizationId,
      requestId: (req as Request & { requestId?: string }).requestId || req.headers['x-request-id'] as string,
    };

    // Track error via ErrorTrackingService
    errorTrackingService.trackError(error, {
      severity: errorReport.severity || ErrorSeverity.Error,
      context: enrichedContext,
      tags: {
        ...errorReport.tags,
        source: 'frontend',
      },
    });

    logger.info('Frontend error tracked successfully', {
      errorName: error.name,
      errorMessage: error.message,
      userId: enrichedContext.userId,
      page: enrichedContext.page,
    });

    res.status(200).json({ success: true, message: 'Error tracked successfully' });
  } catch (error) {
    logger.error('Failed to track frontend error', { error });
    res.status(500).json({ error: 'Failed to track error' });
  }
};
