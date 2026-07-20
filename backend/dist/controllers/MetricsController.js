"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebVitalsStats = exports.trackWebVitals = void 0;
const applicationInsights_1 = require("../config/applicationInsights");
const logger_1 = require("../utils/logger");
const trackWebVitals = async (req, res) => {
    try {
        const payload = req.body;
        if (!payload.metrics || !Array.isArray(payload.metrics) || payload.metrics.length === 0) {
            res.status(400).json({ error: 'Invalid metrics payload' });
            return;
        }
        const MAX_BATCH_SIZE = 100;
        if (payload.metrics.length > MAX_BATCH_SIZE) {
            res.status(400).json({
                error: 'Batch size exceeds maximum limit',
                maxBatchSize: MAX_BATCH_SIZE,
            });
            return;
        }
        const userId = req.user?.id || 'anonymous';
        const organizationId = req.organizationId || 'none';
        for (const metric of payload.metrics) {
            if (!metric.name || typeof metric.value !== 'number') {
                logger_1.logger.warn('Invalid Web Vitals metric in batch', { metric });
                continue;
            }
            let urlPathname = metric.url;
            try {
                urlPathname = new URL(metric.url).pathname;
            }
            catch (urlError) {
                logger_1.logger.warn('Invalid URL in Web Vitals metric, using full URL', {
                    url: metric.url,
                    error: urlError,
                });
            }
            (0, applicationInsights_1.trackMetric)(`webvitals.${metric.name.toLowerCase()}`, metric.value);
            (0, applicationInsights_1.trackEvent)(`webvitals.${metric.name.toLowerCase()}.recorded`, {
                rating: metric.rating,
                navigationType: metric.navigationType,
                url: urlPathname,
                value: String(metric.value),
                delta: String(metric.delta),
                metricId: metric.id,
                userAgent: metric.userAgent,
                userId,
                organizationId,
            });
            (0, applicationInsights_1.trackEvent)(`webvitals.${metric.name.toLowerCase()}.${metric.rating}`, {
                value: String(metric.value),
                url: urlPathname,
            });
        }
        logger_1.logger.info('Web Vitals metrics tracked successfully', {
            count: payload.metrics.length,
            userId,
            metrics: payload.metrics.map(m => `${m.name}:${m.rating}`).join(', '),
        });
        res.status(200).json({
            success: true,
            message: 'Metrics tracked successfully',
            count: payload.metrics.length,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to track Web Vitals metrics', { error });
        res.status(500).json({ error: 'Failed to track metrics' });
    }
};
exports.trackWebVitals = trackWebVitals;
const getWebVitalsStats = async (req, res) => {
    try {
        res.status(200).json({
            message: 'Web Vitals statistics are tracked in Application Insights',
            note: 'Use Azure Portal or Application Insights Analytics API to view aggregated metrics',
            metrics: ['webvitals.lcp', 'webvitals.inp', 'webvitals.cls', 'webvitals.ttfb'],
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get Web Vitals stats', { error });
        res.status(500).json({ error: 'Failed to get statistics' });
    }
};
exports.getWebVitalsStats = getWebVitalsStats;
//# sourceMappingURL=MetricsController.js.map