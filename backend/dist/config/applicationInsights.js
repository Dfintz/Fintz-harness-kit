"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeApplicationInsights = initializeApplicationInsights;
exports.getAppInsightsClient = getAppInsightsClient;
exports.trackEvent = trackEvent;
exports.trackMetric = trackMetric;
exports.trackException = trackException;
exports.trackTrace = trackTrace;
exports.applicationInsightsMiddleware = applicationInsightsMiddleware;
const appInsights = __importStar(require("applicationinsights"));
const logger_1 = require("../utils/logger");
function initializeApplicationInsights() {
    const instrumentationKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY;
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (!instrumentationKey && !connectionString) {
        logger_1.logger.info('Application Insights not configured - telemetry collection disabled');
        return;
    }
    try {
        if (connectionString) {
            appInsights
                .setup(connectionString)
                .setAutoCollectConsole(false, false)
                .setAutoCollectExceptions(true)
                .setAutoCollectPerformance(false, false)
                .setAutoCollectRequests(true)
                .setAutoCollectDependencies(false)
                .setAutoCollectIncomingRequestAzureFunctions(false)
                .setSendLiveMetrics(false);
        }
        else if (instrumentationKey) {
            appInsights
                .setup(instrumentationKey)
                .setAutoCollectConsole(true, true)
                .setAutoCollectExceptions(true)
                .setAutoCollectPerformance(true, true)
                .setAutoCollectRequests(true)
                .setAutoCollectDependencies(true)
                .setSendLiveMetrics(true);
        }
        const defaultSampling = process.env.NODE_ENV === 'production' ? 5 : 100;
        const samplingPercentage = process.env.APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE
            ? parseInt(process.env.APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE, 10)
            : defaultSampling;
        if (!isNaN(samplingPercentage) && samplingPercentage >= 1 && samplingPercentage <= 100) {
            appInsights.defaultClient.config.samplingPercentage = samplingPercentage;
        }
        else {
            logger_1.logger.warn('Invalid APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE, using default', {
                provided: samplingPercentage,
                default: defaultSampling,
            });
            appInsights.defaultClient.config.samplingPercentage = defaultSampling;
        }
        appInsights.start();
        const client = appInsights.defaultClient;
        if (client) {
            const version = process.env.APP_VERSION || 'unknown';
            client.context.tags[client.context.keys.applicationVersion] = version;
            client.context.tags[client.context.keys.cloudRole] = 'sc-fleet-manager-backend';
            client.context.tags[client.context.keys.cloudRoleInstance] =
                process.env.HOSTNAME || 'unknown';
        }
        logger_1.logger.info('Application Insights initialized successfully', {
            instrumentationKey: instrumentationKey
                ? `${instrumentationKey.substring(0, 8)}...`
                : undefined,
            connectionString: connectionString ? 'configured' : undefined,
            version: '3.x (OpenTelemetry-based)',
            autoCollect: 'exceptions and requests only',
            samplingPercentage: client?.config.samplingPercentage || 'disabled',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize Application Insights', { error });
    }
}
function getAppInsightsClient() {
    return appInsights.defaultClient;
}
function trackEvent(name, properties) {
    const client = getAppInsightsClient();
    if (client) {
        client.trackEvent({ name, properties });
    }
}
function trackMetric(name, value) {
    const client = getAppInsightsClient();
    if (client) {
        client.trackMetric({ name, value });
    }
}
function trackException(exception, properties) {
    const client = getAppInsightsClient();
    if (client) {
        client.trackException({ exception, properties });
    }
}
function trackTrace(message, severity, properties) {
    const client = getAppInsightsClient();
    if (client) {
        client.trackTrace({ message, severity, properties });
    }
}
function applicationInsightsMiddleware() {
    return (req, res, next) => {
        const startTime = Date.now();
        const client = getAppInsightsClient();
        const originalSend = res.send;
        res.send = function (data) {
            const duration = Date.now() - startTime;
            const statusCode = res.statusCode;
            if (client) {
                trackMetric('http_request_duration_ms', duration);
                const _statusRange = Math.floor(statusCode / 100) * 100;
                trackEvent('http_request_completed', {
                    method: req.method,
                    path: req.route?.path || req.path,
                    statusCode: String(statusCode),
                    duration: String(duration),
                });
                if (statusCode >= 400) {
                    trackEvent('http_error_response', {
                        method: req.method,
                        path: req.route?.path || req.path,
                        statusCode: String(statusCode),
                        duration: String(duration),
                    });
                }
            }
            return originalSend.call(this, data);
        };
        const originalJson = res.json;
        res.json = function (data) {
            const duration = Date.now() - startTime;
            if (res.statusCode >= 400 && client) {
                const properties = {
                    method: req.method,
                    path: req.route?.path || req.path,
                    statusCode: String(res.statusCode),
                    duration: String(duration),
                };
                const errorData = data;
                if (errorData?.error) {
                    properties.error =
                        typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
                }
                if (res.statusCode >= 500) {
                    trackEvent('http_server_error', properties);
                }
                else if (res.statusCode >= 400) {
                    trackEvent('http_client_error', properties);
                }
            }
            return originalJson.call(this, data);
        };
        next();
    };
}
//# sourceMappingURL=applicationInsights.js.map