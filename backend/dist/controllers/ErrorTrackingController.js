"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackFrontendError = void 0;
const ErrorTrackingService_1 = require("../services/monitoring/ErrorTrackingService");
const logger_1 = require("../utils/logger");
const trackFrontendError = async (req, res) => {
    try {
        const errorReport = req.body;
        if (!errorReport.error?.message) {
            res.status(400).json({ error: 'Invalid error report payload' });
            return;
        }
        const error = new Error(errorReport.error.message);
        error.name = errorReport.error.name || 'FrontendError';
        error.stack = errorReport.error.stack;
        const enrichedContext = {
            ...errorReport.context,
            userId: errorReport.context.userId || req.user?.id,
            organizationId: errorReport.context.organizationId || req.organizationId,
            requestId: req.requestId || req.headers['x-request-id'],
        };
        ErrorTrackingService_1.errorTrackingService.trackError(error, {
            severity: errorReport.severity || ErrorTrackingService_1.ErrorSeverity.Error,
            context: enrichedContext,
            tags: {
                ...errorReport.tags,
                source: 'frontend',
            },
        });
        logger_1.logger.info('Frontend error tracked successfully', {
            errorName: error.name,
            errorMessage: error.message,
            userId: enrichedContext.userId,
            page: enrichedContext.page,
        });
        res.status(200).json({ success: true, message: 'Error tracked successfully' });
    }
    catch (error) {
        logger_1.logger.error('Failed to track frontend error', { error });
        res.status(500).json({ error: 'Failed to track error' });
    }
};
exports.trackFrontendError = trackFrontendError;
//# sourceMappingURL=ErrorTrackingController.js.map