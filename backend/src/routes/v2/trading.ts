/**
 * API v2 - Trading Routes
 * Trading and market analysis endpoints with standardized responses
 */

import { Router } from 'express';

import { TradingControllerV2 } from '../../controllers/v2/tradingController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { tradingSchemas } from '../../schemas';
import { tradingRouteQuerySchemas } from '../../schemas/tradingRouteQuerySchemas';

const router = Router();
const controller = new TradingControllerV2();

// Organization-scoped middleware chain
const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// Organization-scoped trading operations
router.get(
  '/organizations/:orgId/trading/routes',
  ...orgAuth,
  validateSchema(tradingRouteQuerySchemas.listQuery, 'query'),
  controller.listOrgRoutes.bind(controller)
);

router.post(
  '/organizations/:orgId/trading/routes',
  ...orgAuth,
  validateSchema(tradingSchemas.createRoute),
  controller.createRoute.bind(controller)
);

router.get(
  '/organizations/:orgId/trading/analytics',
  ...orgAuth,
  controller.getOrgAnalytics.bind(controller)
);

router.get(
  '/organizations/:orgId/trading/uex-routes',
  ...orgAuth,
  controller.getUexRoutes.bind(controller)
);

router.get(
  '/organizations/:orgId/trading/uex-terminals',
  ...orgAuth,
  controller.getUexTerminals.bind(controller)
);

router.get(
  '/organizations/:orgId/trading/uex-commodities',
  ...orgAuth,
  controller.getUexCommodities.bind(controller)
);

// Market analysis endpoints
router.get(
  '/trading/commodities/:commodity/prices',
  authenticate,
  controller.getCommodityPrices.bind(controller)
);

router.get('/trading/market/trends', authenticate, controller.getMarketTrends.bind(controller));

router.post('/trading/prices', authenticate, controller.recordPrice.bind(controller));

router.get('/trading/market-analysis', authenticate, controller.getMarketAnalysis.bind(controller));

// Route-specific endpoints
router.get(
  '/trading/routes/:id',
  authenticate,
  validateSchema(tradingRouteQuerySchemas.idParam, 'params'),
  controller.getRouteById.bind(controller)
);

router.put(
  '/trading/routes/:id',
  authenticate,
  validateSchema(tradingRouteQuerySchemas.idParam, 'params'),
  validateSchema(tradingSchemas.updateRoute),
  controller.updateRoute.bind(controller)
);

router.delete(
  '/trading/routes/:id',
  authenticate,
  validateSchema(tradingRouteQuerySchemas.idParam, 'params'),
  controller.deleteRoute.bind(controller)
);

router.get(
  '/trading/routes/:id/profitability',
  authenticate,
  validateSchema(tradingRouteQuerySchemas.idParam, 'params'),
  controller.getRouteProfitability.bind(controller)
);

router.post(
  '/trading/routes/:id/runs',
  authenticate,
  validateSchema(tradingRouteQuerySchemas.idParam, 'params'),
  controller.recordRouteRun.bind(controller)
);

router.get('/trading/opportunities', authenticate, controller.getOpportunities.bind(controller));

router.post(
  '/trading/routes/refresh',
  authenticate,
  controller.refreshRouteProfits.bind(controller)
);

// Price alert endpoints
router.get('/trading/price-alerts', authenticate, controller.listPriceAlerts.bind(controller));

router.post(
  '/trading/price-alerts',
  authenticate,
  validateSchema(tradingSchemas.createPriceAlert),
  controller.createPriceAlert.bind(controller)
);

router.patch(
  '/trading/price-alerts/:id',
  authenticate,
  validateSchema(tradingSchemas.updatePriceAlert),
  controller.updatePriceAlert.bind(controller)
);

router.delete(
  '/trading/price-alerts/:id',
  authenticate,
  controller.deletePriceAlert.bind(controller)
);

// Price feed status
router.get(
  '/trading/price-feed/status',
  authenticate,
  controller.getPriceFeedStatus.bind(controller)
);

// Trade reputation endpoints (Sprint 20-D)
router.get(
  '/trading/reputation/leaderboard',
  authenticate,
  controller.getTradeReputationLeaderboard.bind(controller)
);

router.get(
  '/trading/reputation/:userId',
  authenticate,
  controller.getTradeReputation.bind(controller)
);

router.get(
  '/organizations/:orgId/trading/transactions',
  ...orgAuth,
  controller.getTradeTransactions.bind(controller)
);

router.get(
  '/organizations/:orgId/trading/disputes',
  ...orgAuth,
  validateSchema(tradingSchemas.listDisputes, 'query'),
  controller.listTradeDisputes.bind(controller)
);

router.post(
  '/organizations/:orgId/trading/disputes',
  ...orgAuth,
  validateSchema(tradingSchemas.createDispute),
  controller.createTradeDispute.bind(controller)
);

router.post(
  '/organizations/:orgId/trading/disputes/:disputeId/resolve',
  ...orgAuth,
  validateSchema(tradingSchemas.resolveDispute),
  controller.resolveTradeDispute.bind(controller)
);

// Aggregator endpoints
router.post(
  '/trading/routes/:id/execute-run',
  authenticate,
  validateSchema(tradingSchemas.executeTradeRun),
  controller.executeTradeRun.bind(controller)
);

router.post(
  '/organizations/:orgId/trading/operations',
  ...orgAuth,
  validateSchema(tradingSchemas.createTradeOperation),
  controller.createTradeOperation.bind(controller)
);

export { router };
