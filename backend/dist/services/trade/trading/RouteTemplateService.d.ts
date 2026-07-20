import { TradeStop } from '../../../models/TradingRoute';
import { CreateTradingRouteDto } from './TradingService';
export interface RouteTemplate {
    id: string;
    name: string;
    description: string;
    category: RouteCategory;
    difficulty: RouteDifficulty;
    estimatedProfit: number;
    estimatedDuration: number;
    minCargoCapacity: number;
    riskLevel: RiskLevel;
    stops: TradeStop[];
    tags: string[];
    requirements?: string[];
    tips?: string[];
}
export declare enum RouteCategory {
    MINING = "mining",
    COMMODITY = "commodity",
    MEDICAL = "medical",
    ILLEGAL = "illegal",
    HIGH_VALUE = "high_value",
    BULK = "bulk",
    BEGINNER = "beginner"
}
export declare enum RouteDifficulty {
    EASY = "easy",
    MEDIUM = "medium",
    HARD = "hard",
    EXPERT = "expert"
}
export declare enum RiskLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    EXTREME = "extreme"
}
export declare const ROUTE_TEMPLATES: RouteTemplate[];
export declare class RouteTemplateService {
    getAllTemplates(): RouteTemplate[];
    getTemplatesByCategory(category: RouteCategory): RouteTemplate[];
    getTemplatesByDifficulty(difficulty: RouteDifficulty): RouteTemplate[];
    getTemplatesByRiskLevel(riskLevel: RiskLevel): RouteTemplate[];
    getTemplatesForCargoCapacity(cargoCapacity: number): RouteTemplate[];
    getTemplateById(id: string): RouteTemplate | undefined;
    searchByTag(tag: string): RouteTemplate[];
    templateToDto(template: RouteTemplate, creatorId: string, organizationId: string): CreateTradingRouteDto;
    getBeginnerTemplates(): RouteTemplate[];
    getMostProfitableTemplates(limit?: number): RouteTemplate[];
    getFastestTemplates(limit?: number): RouteTemplate[];
    getBestProfitPerMinute(limit?: number): RouteTemplate[];
}
export declare const routeTemplateServiceInstance: RouteTemplateService;
//# sourceMappingURL=RouteTemplateService.d.ts.map