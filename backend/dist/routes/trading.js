"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const TradingRoute_1 = require("../models/TradingRoute");
const schemas_1 = require("../schemas");
const TradingService_1 = require("../services/trade/trading/TradingService");
const logger_1 = require("../utils/logger");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const router = (0, express_1.Router)();
exports.router = router;
function requireOrgId(req, res) {
    const orgId = req.user?.currentOrganizationId;
    if (!orgId) {
        res.status(400).json({ error: 'No active organization selected' });
        return null;
    }
    return orgId;
}
router.post('/routes', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.tradingSchemas.createRoute, 'body'), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const dto = {
            ...(0, prototypePollutionPrevention_1.sanitizeObject)(req.body),
            creatorId: req.user.id,
        };
        const route = await TradingService_1.tradingService.createRoute(dto);
        return res.status(201).json(route);
    }
    catch (error) {
        logger_1.logger.error('Error creating trading route:', error);
        return res.status(500).json({ error: 'Failed to create trading route' });
    }
});
router.get('/routes', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.tradingRouteQuerySchemas.listQuery, 'query'), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!req.user.currentOrganizationId) {
            return res.status(400).json({ error: 'No organization selected' });
        }
        const filters = {
            organizationId: req.user.currentOrganizationId,
            creatorId: req.user.id,
        };
        if (req.query.status && typeof req.query.status === 'string') {
            const validStatuses = Object.values(TradingRoute_1.RouteStatus);
            if (validStatuses.includes(req.query.status)) {
                filters.status = req.query.status;
            }
        }
        if (req.query.tags && typeof req.query.tags === 'string') {
            filters.tags = req.query.tags.split(',').map(t => t.trim());
        }
        const routes = await TradingService_1.tradingService.getRoutes(filters);
        return res.json(routes);
    }
    catch (error) {
        logger_1.logger.error('Error getting trading routes:', error);
        return res.status(500).json({ error: 'Failed to get trading routes' });
    }
});
router.get('/routes/:id', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const orgId = requireOrgId(req, res);
        if (!orgId) {
            return;
        }
        const route = await TradingService_1.tradingService.getRouteById(req.params.id, orgId);
        if (!route) {
            return res.status(404).json({ error: 'Trading route not found' });
        }
        if (route.creatorId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        return res.json(route);
    }
    catch (error) {
        logger_1.logger.error('Error getting trading route:', error);
        return res.status(500).json({ error: 'Failed to get trading route' });
    }
});
router.put('/routes/:id', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.tradingSchemas.updateRoute, 'body'), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const orgId = requireOrgId(req, res);
        if (!orgId) {
            return;
        }
        const route = await TradingService_1.tradingService.getRouteById(req.params.id, orgId);
        if (!route) {
            return res.status(404).json({ error: 'Trading route not found' });
        }
        if (route.creatorId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const updatedRoute = await TradingService_1.tradingService.updateRoute(req.params.id, req.body, route.organizationId);
        return res.json(updatedRoute);
    }
    catch (error) {
        logger_1.logger.error('Error updating trading route:', error);
        return res.status(500).json({ error: 'Failed to update trading route' });
    }
});
router.delete('/routes/:id', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const orgId = requireOrgId(req, res);
        if (!orgId) {
            return;
        }
        const route = await TradingService_1.tradingService.getRouteById(req.params.id, orgId);
        if (!route) {
            return res.status(404).json({ error: 'Trading route not found' });
        }
        if (route.creatorId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        await TradingService_1.tradingService.deleteRoute(req.params.id, route.organizationId);
        return res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error('Error deleting trading route:', error);
        return res.status(500).json({ error: 'Failed to delete trading route' });
    }
});
router.post('/routes/:id/runs', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.tradingSchemas.recordCompletion, 'body'), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const orgId = requireOrgId(req, res);
        if (!orgId) {
            return;
        }
        const route = await TradingService_1.tradingService.getRouteById(req.params.id, orgId);
        if (!route) {
            return res.status(404).json({ error: 'Trading route not found' });
        }
        if (route.creatorId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const updatedRoute = await TradingService_1.tradingService.recordRouteRun(req.params.id, req.body.profit, req.body.duration, route.organizationId);
        return res.json(updatedRoute);
    }
    catch (error) {
        logger_1.logger.error('Error recording route run:', error);
        return res.status(500).json({ error: 'Failed to record route run' });
    }
});
router.get('/opportunities', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.querySchemas.search, 'query'), async (req, res) => {
    try {
        const startLocation = req.query.startLocation;
        const minProfitMargin = Number.parseFloat(req.query.minProfitMargin) || 10;
        const limit = Number.parseInt(req.query.limit, 10) || 10;
        const opportunities = await TradingService_1.tradingService.findTradeOpportunities(startLocation, minProfitMargin, limit);
        return res.json(opportunities);
    }
    catch (error) {
        logger_1.logger.error('Error finding trade opportunities:', error);
        return res.status(500).json({ error: 'Failed to find trade opportunities' });
    }
});
router.post('/routes/optimize', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.tradingSchemas.generateRoute, 'body'), async (req, res) => {
    try {
        const stops = await TradingService_1.tradingService.optimizeRoute(req.body);
        return res.json({ stops });
    }
    catch (error) {
        logger_1.logger.error('Error optimizing route:', error);
        return res.status(500).json({ error: 'Failed to optimize route' });
    }
});
router.get('/routes/:id/analysis', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), async (req, res) => {
    try {
        const orgId = requireOrgId(req, res);
        if (!orgId) {
            return;
        }
        const route = await TradingService_1.tradingService.getRouteById(req.params.id, orgId);
        if (!route) {
            return res.status(404).json({ error: 'Trading route not found' });
        }
        if (route.creatorId !== req.user?.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const analysis = await TradingService_1.tradingService.analyzeRouteProfitability(req.params.id, orgId);
        return res.json(analysis);
    }
    catch (error) {
        logger_1.logger.error('Error analyzing route:', error);
        return res.status(500).json({ error: 'Failed to analyze route' });
    }
});
router.post('/routes/refresh', auth_1.authenticateToken, async (req, res) => {
    try {
        const result = await TradingService_1.tradingService.refreshAllRouteProfits();
        return res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Error refreshing route profits:', error);
        return res.status(500).json({ error: 'Failed to refresh route profits' });
    }
});
//# sourceMappingURL=trading.js.map