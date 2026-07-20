"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
router.post('/web-vitals', (0, schemaValidation_1.validateSchema)(schemas_1.monitoringSchemas.trackWebVitals, 'body'), async (req, res) => {
    try {
        const { metrics } = req.body;
        if (!metrics || !Array.isArray(metrics)) {
            return res.status(400).json({ error: 'Invalid metrics data' });
        }
        if (process.env.NODE_ENV === 'development') {
            logger_1.logger.info(`Received ${metrics.length} Web Vitals metrics`);
            metrics.forEach((metric) => {
                logger_1.logger.debug(`Web Vital - ${metric.name}: ${metric.value}ms`);
            });
        }
        res.status(200).json({
            success: true,
            received: metrics.length,
        });
    }
    catch (error) {
        logger_1.logger.error('Error processing Web Vitals metrics:', error);
        res.status(500).json({ error: 'Failed to process metrics' });
    }
});
//# sourceMappingURL=metrics.js.map