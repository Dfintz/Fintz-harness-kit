"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorTrackingService = exports.ErrorTrackingService = exports.ErrorSeverity = void 0;
const applicationInsights_1 = require("../../config/applicationInsights");
const requestCorrelation_1 = require("../../middleware/requestCorrelation");
const logger_1 = require("../../utils/logger");
const securityUtils_1 = require("../../utils/securityUtils");
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity[ErrorSeverity["Verbose"] = 0] = "Verbose";
    ErrorSeverity[ErrorSeverity["Information"] = 1] = "Information";
    ErrorSeverity[ErrorSeverity["Warning"] = 2] = "Warning";
    ErrorSeverity[ErrorSeverity["Error"] = 3] = "Error";
    ErrorSeverity[ErrorSeverity["Critical"] = 4] = "Critical";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
class ErrorTrackingService {
    static instance;
    isInitialized = false;
    constructor() { }
    static getInstance() {
        if (!ErrorTrackingService.instance) {
            ErrorTrackingService.instance = new ErrorTrackingService();
        }
        return ErrorTrackingService.instance;
    }
    initialize() {
        if (this.isInitialized) {
            logger_1.logger.warn('ErrorTrackingService already initialized');
            return;
        }
        this.setupGlobalErrorHandlers();
        this.isInitialized = true;
        logger_1.logger.info('ErrorTrackingService initialized successfully');
    }
    trackError(error, options = {}) {
        const { severity = ErrorSeverity.Error, context, tags, metrics } = options;
        const properties = {
            errorName: error.name,
            errorMessage: error.message,
            severity: ErrorSeverity[severity],
            timestamp: new Date().toISOString(),
            ...this.buildContextProperties(context),
            ...tags,
        };
        if (error.stack) {
            properties.stackTrace = error.stack;
        }
        const sanitizedProperties = (0, securityUtils_1.sanitizeObject)(properties);
        const telemetryProperties = this.toTelemetryProperties(sanitizedProperties);
        logger_1.logger.error('Error tracked', {
            error: error.message,
            stack: error.stack,
            ...sanitizedProperties,
        });
        const client = (0, applicationInsights_1.getAppInsightsClient)();
        if (client) {
            client.trackException({
                exception: error,
                properties: telemetryProperties,
                measurements: metrics,
                severity: severity,
            });
            if (severity === ErrorSeverity.Critical) {
                void client.flush();
            }
        }
    }
    trackRequestError(error, req, options = {}) {
        const context = this.extractRequestContext(req);
        this.trackError(error, {
            ...options,
            context: {
                ...context,
                ...options.context,
            },
        });
    }
    trackAsyncError(error, context) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        this.trackError(errorObj, {
            severity: ErrorSeverity.Error,
            context,
            tags: {
                errorType: 'unhandledRejection',
            },
        });
    }
    trackCriticalError(error, context) {
        this.trackError(error, {
            severity: ErrorSeverity.Critical,
            context,
        });
    }
    extractRequestContext(req) {
        const correlationData = (0, requestCorrelation_1.getCorrelationData)(req);
        const breadcrumbs = (0, requestCorrelation_1.getBreadcrumbs)(req);
        const queryParams = (0, securityUtils_1.sanitizeQueryParams)(req.query);
        const requestSize = req.headers['content-length']
            ? parseInt(req.headers['content-length'], 10)
            : undefined;
        return {
            userId: req.user
                ? req.user
                    ?.id
                : req.userId,
            organizationId: req.organizationId ||
                req.org
                    ?.id,
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
    buildContextProperties(context) {
        if (!context) {
            return {};
        }
        const properties = {};
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
        if (context.breadcrumbs && context.breadcrumbs.length > 0) {
            try {
                properties.breadcrumbs = JSON.stringify(context.breadcrumbs);
            }
            catch (err) {
                logger_1.logger.warn('Failed to stringify breadcrumbs', { err });
            }
        }
        if (context.queryParams) {
            try {
                properties.queryParams = JSON.stringify((0, securityUtils_1.sanitizeQueryParams)(context.queryParams));
            }
            catch (err) {
                logger_1.logger.warn('Failed to stringify query params', { err });
            }
        }
        if (context.additionalData) {
            try {
                properties.additionalData = JSON.stringify((0, securityUtils_1.sanitizeObject)(context.additionalData));
            }
            catch (err) {
                logger_1.logger.warn('Failed to stringify additional error data', { err });
            }
        }
        return properties;
    }
    toTelemetryProperties(properties) {
        const telemetryProperties = {};
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
            }
            catch {
                telemetryProperties[key] = '[Unserializable value]';
            }
        }
        return telemetryProperties;
    }
    setupGlobalErrorHandlers() {
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught Exception detected', {
                error: error.message,
                stack: error.stack,
            });
            this.trackError(error, {
                severity: ErrorSeverity.Critical,
                tags: {
                    errorType: 'uncaughtException',
                },
            });
            const client = (0, applicationInsights_1.getAppInsightsClient)();
            if (client) {
                void client.flush();
                setTimeout(() => {
                    logger_1.logger.error('Process will exit due to uncaught exception');
                    process.exit(1);
                }, 1000);
            }
            else {
                logger_1.logger.error('Process will exit due to uncaught exception');
                process.exit(1);
            }
        });
        process.on('unhandledRejection', (reason, _promise) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            const errorMessage = error.message || String(reason);
            const isQuotaError = errorMessage.includes('Daily quota exceeded') ||
                errorMessage.includes('PeriodicExportingMetricReader') ||
                reason?.statusCode === 439;
            if (isQuotaError) {
                logger_1.logger.warn('Application Insights quota exceeded - telemetry export throttled', {
                    message: errorMessage,
                    statusCode: reason?.statusCode || 439,
                });
                return;
            }
            logger_1.logger.error('Unhandled Promise Rejection detected', {
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
        process.on('warning', (warning) => {
            logger_1.logger.warn('Node.js warning detected', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack,
            });
            this.trackError(warning, {
                severity: ErrorSeverity.Warning,
                tags: {
                    errorType: 'nodeWarning',
                },
            });
        });
    }
}
exports.ErrorTrackingService = ErrorTrackingService;
exports.errorTrackingService = ErrorTrackingService.getInstance();
//# sourceMappingURL=ErrorTrackingService.js.map