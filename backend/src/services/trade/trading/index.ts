/**
 * Trade Domain - Trading Submodule
 *
 * Services for managing trading operations and UIF (Universal Item Finder)
 * Part of the unified Trade domain for commodity and supply chain management
 */

export {
  RiskLevel,
  ROUTE_TEMPLATES,
  RouteCategory,
  RouteDifficulty,
  RouteTemplateService,
} from './RouteTemplateService';
export type { RouteTemplate } from './RouteTemplateService';
export { TradeReputationService, tradeReputationService } from './TradeReputationService';
export type {
  RecordTradeTransactionParams,
  TradeReputationLeaderboard,
} from './TradeReputationService';
export { TradingService } from './TradingService';
export type {
  CreateTradingRouteDto,
  PriceChartData,
  PriceHistoryPoint,
  RouteOptimizationOptions,
  RouteShare,
  TradeOpportunity,
  UpdateTradingRouteDto,
} from './TradingService';
export { UEXPriceFeed } from './UEXPriceFeed';
export type {
  UEXCommodityInfo,
  UEXRouteSearchParams,
  UEXTerminalInfo,
  UEXTradeRoute,
} from './UEXPriceFeed';
export { UIFService } from './UIFService';

// Price Alert Service for real-time trading notifications
export { PriceAlert } from '../../../models/PriceAlert';
export type { PriceAlertCondition } from '../../../models/PriceAlert';
export { AlertCondition, PriceAlertService, priceAlertService } from './PriceAlertService';
export type { PriceAlertEvent } from './PriceAlertService';

