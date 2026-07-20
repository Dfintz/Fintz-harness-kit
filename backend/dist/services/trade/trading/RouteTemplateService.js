"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeTemplateServiceInstance = exports.RouteTemplateService = exports.ROUTE_TEMPLATES = exports.RiskLevel = exports.RouteDifficulty = exports.RouteCategory = void 0;
var RouteCategory;
(function (RouteCategory) {
    RouteCategory["MINING"] = "mining";
    RouteCategory["COMMODITY"] = "commodity";
    RouteCategory["MEDICAL"] = "medical";
    RouteCategory["ILLEGAL"] = "illegal";
    RouteCategory["HIGH_VALUE"] = "high_value";
    RouteCategory["BULK"] = "bulk";
    RouteCategory["BEGINNER"] = "beginner";
})(RouteCategory || (exports.RouteCategory = RouteCategory = {}));
var RouteDifficulty;
(function (RouteDifficulty) {
    RouteDifficulty["EASY"] = "easy";
    RouteDifficulty["MEDIUM"] = "medium";
    RouteDifficulty["HARD"] = "hard";
    RouteDifficulty["EXPERT"] = "expert";
})(RouteDifficulty || (exports.RouteDifficulty = RouteDifficulty = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["LOW"] = "low";
    RiskLevel["MEDIUM"] = "medium";
    RiskLevel["HIGH"] = "high";
    RiskLevel["EXTREME"] = "extreme";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
exports.ROUTE_TEMPLATES = [
    {
        id: 'beginner-laranite-run',
        name: 'Beginner Laranite Run',
        description: 'A safe and profitable route for new traders. Buy Laranite at mining outposts and sell at major landing zones.',
        category: RouteCategory.BEGINNER,
        difficulty: RouteDifficulty.EASY,
        estimatedProfit: 5000,
        estimatedDuration: 20,
        minCargoCapacity: 8,
        riskLevel: RiskLevel.LOW,
        stops: [
            { location: 'Lathan', buyGoods: ['Laranite'], order: 0 },
            { location: 'Area 18', sellGoods: ['Laranite'], order: 1 },
        ],
        tags: ['beginner', 'safe', 'laranite', 'mining'],
        requirements: ['Small cargo ship (8+ SCU)'],
        tips: [
            'Check commodity prices before departing',
            'Laranite prices fluctuate - buy low, sell high',
            'This route is safe for new players',
        ],
    },
    {
        id: 'beginner-medical-supplies',
        name: 'Medical Supply Run',
        description: 'Transport medical supplies between stations. Low risk and consistent profits.',
        category: RouteCategory.MEDICAL,
        difficulty: RouteDifficulty.EASY,
        estimatedProfit: 3500,
        estimatedDuration: 15,
        minCargoCapacity: 4,
        riskLevel: RiskLevel.LOW,
        stops: [
            { location: 'Orison', buyGoods: ['Medical Supplies'], order: 0 },
            { location: 'GrimHEX', sellGoods: ['Medical Supplies'], order: 1 },
        ],
        tags: ['beginner', 'safe', 'medical', 'consistent'],
        requirements: ['Any cargo ship'],
        tips: [
            'Medical supplies are always in demand',
            'GrimHEX offers premium prices',
            'Quick turnaround time',
        ],
    },
    {
        id: 'mining-agricium-circuit',
        name: 'Agricium Mining Circuit',
        description: 'Collect Agricium from mining facilities and sell at the best prices. Moderate risk.',
        category: RouteCategory.MINING,
        difficulty: RouteDifficulty.MEDIUM,
        estimatedProfit: 8500,
        estimatedDuration: 30,
        minCargoCapacity: 16,
        riskLevel: RiskLevel.MEDIUM,
        stops: [
            { location: 'Bezdek', buyGoods: ['Agricium'], order: 0 },
            { location: 'Deakins Research', buyGoods: ['Titanium'], order: 1 },
            { location: 'New Babbage', sellGoods: ['Agricium', 'Titanium'], order: 2 },
        ],
        tags: ['mining', 'agricium', 'titanium', 'multi-stop'],
        requirements: ['Medium cargo ship (16+ SCU)', 'QT fuel for multiple jumps'],
        tips: [
            'Combine pickups to maximize efficiency',
            'Watch for pirates near mining facilities',
            'New Babbage offers competitive prices',
        ],
    },
    {
        id: 'mining-quantanium-express',
        name: 'Quantanium Express',
        description: 'High-value Quantanium transport. Time-sensitive due to material instability.',
        category: RouteCategory.HIGH_VALUE,
        difficulty: RouteDifficulty.HARD,
        estimatedProfit: 25000,
        estimatedDuration: 15,
        minCargoCapacity: 32,
        riskLevel: RiskLevel.HIGH,
        stops: [
            { location: 'ARC-L1', buyGoods: ['Quantanium'], order: 0 },
            { location: 'Area 18', sellGoods: ['Quantanium'], order: 1 },
        ],
        tags: ['mining', 'quantanium', 'high-value', 'time-sensitive'],
        requirements: ['Large cargo ship (32+ SCU)', 'Fast ship recommended'],
        tips: [
            'Quantanium is unstable - sell quickly!',
            '15-minute timer starts when you pick up',
            'Use the fastest route possible',
            'High reward but high risk of explosion',
        ],
    },
    {
        id: 'commodity-stanton-loop',
        name: 'Stanton Trade Loop',
        description: 'Complete circuit around Stanton system trading various commodities.',
        category: RouteCategory.COMMODITY,
        difficulty: RouteDifficulty.MEDIUM,
        estimatedProfit: 15000,
        estimatedDuration: 45,
        minCargoCapacity: 48,
        riskLevel: RiskLevel.MEDIUM,
        stops: [
            { location: 'Port Olisar', buyGoods: ['Distilled Spirits'], order: 0 },
            {
                location: 'Lorville',
                sellGoods: ['Distilled Spirits'],
                buyGoods: ['Processed Food'],
                order: 1,
            },
            { location: 'New Babbage', sellGoods: ['Processed Food'], buyGoods: ["E'tam"], order: 2 },
            { location: 'Area 18', sellGoods: ["E'tam"], order: 3 },
        ],
        tags: ['commodity', 'loop', 'multi-commodity', 'stanton'],
        requirements: ['Large cargo ship (48+ SCU)', 'Fuel for full Stanton circuit'],
        tips: [
            'Follow the loop for maximum efficiency',
            'Each stop has optimal buy/sell goods',
            'Takes about 45 minutes for full circuit',
            'Consider fuel costs in profit calculation',
        ],
    },
    {
        id: 'high-value-slam-run',
        name: 'SLAM Distribution Run',
        description: 'Transport the illegal drug SLAM for high profits. Extremely risky.',
        category: RouteCategory.ILLEGAL,
        difficulty: RouteDifficulty.EXPERT,
        estimatedProfit: 50000,
        estimatedDuration: 25,
        minCargoCapacity: 24,
        riskLevel: RiskLevel.EXTREME,
        stops: [
            { location: 'JumpTown', buyGoods: ['SLAM'], order: 0 },
            { location: 'GrimHEX', sellGoods: ['SLAM'], order: 1 },
        ],
        tags: ['illegal', 'slam', 'high-risk', 'high-reward'],
        requirements: ['Medium cargo ship (24+ SCU)', 'Combat or stealth capability'],
        tips: [
            'JumpTown is a PvP hotspot - expect combat',
            'Bring escort ships if possible',
            'Illegal goods mean no insurance payout',
            'Security forces will scan and attack',
            'Only for experienced players',
        ],
    },
    {
        id: 'bulk-scrap-haul',
        name: 'Bulk Scrap Hauling',
        description: 'Low-margin but high-volume scrap transport. Perfect for large cargo ships.',
        category: RouteCategory.BULK,
        difficulty: RouteDifficulty.EASY,
        estimatedProfit: 12000,
        estimatedDuration: 35,
        minCargoCapacity: 96,
        riskLevel: RiskLevel.LOW,
        stops: [
            { location: 'Reclamation & Disposal', buyGoods: ['Scrap'], order: 0 },
            { location: 'Port Olisar', sellGoods: ['Scrap'], order: 1 },
        ],
        tags: ['bulk', 'scrap', 'low-margin', 'high-volume'],
        requirements: ['Large cargo ship (96+ SCU)', 'C2 Hercules or similar recommended'],
        tips: [
            'Volume is key - fill your entire cargo hold',
            'Low risk, consistent profits',
            'Good for passive income while doing other activities',
            'Great for new players with large ships',
        ],
    },
];
class RouteTemplateService {
    getAllTemplates() {
        return exports.ROUTE_TEMPLATES;
    }
    getTemplatesByCategory(category) {
        return exports.ROUTE_TEMPLATES.filter(t => t.category === category);
    }
    getTemplatesByDifficulty(difficulty) {
        return exports.ROUTE_TEMPLATES.filter(t => t.difficulty === difficulty);
    }
    getTemplatesByRiskLevel(riskLevel) {
        return exports.ROUTE_TEMPLATES.filter(t => t.riskLevel === riskLevel);
    }
    getTemplatesForCargoCapacity(cargoCapacity) {
        return exports.ROUTE_TEMPLATES.filter(t => t.minCargoCapacity <= cargoCapacity);
    }
    getTemplateById(id) {
        return exports.ROUTE_TEMPLATES.find(t => t.id === id);
    }
    searchByTag(tag) {
        const normalizedTag = tag.toLowerCase();
        return exports.ROUTE_TEMPLATES.filter(t => t.tags.some(tTag => tTag.toLowerCase().includes(normalizedTag)));
    }
    templateToDto(template, creatorId, organizationId) {
        return {
            name: template.name,
            description: template.description,
            creatorId,
            organizationId,
            stops: template.stops,
            estimatedProfit: template.estimatedProfit,
            estimatedDuration: template.estimatedDuration,
            minCargoCapacity: template.minCargoCapacity,
            tags: [...template.tags, 'from-template', template.id],
        };
    }
    getBeginnerTemplates() {
        return exports.ROUTE_TEMPLATES.filter(t => t.difficulty === RouteDifficulty.EASY || t.category === RouteCategory.BEGINNER);
    }
    getMostProfitableTemplates(limit = 5) {
        return [...exports.ROUTE_TEMPLATES]
            .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
            .slice(0, limit);
    }
    getFastestTemplates(limit = 5) {
        return [...exports.ROUTE_TEMPLATES]
            .sort((a, b) => a.estimatedDuration - b.estimatedDuration)
            .slice(0, limit);
    }
    getBestProfitPerMinute(limit = 5) {
        return [...exports.ROUTE_TEMPLATES]
            .map(t => ({
            ...t,
            profitPerMinute: t.estimatedProfit / t.estimatedDuration,
        }))
            .sort((a, b) => b.profitPerMinute - a.profitPerMinute)
            .slice(0, limit);
    }
}
exports.RouteTemplateService = RouteTemplateService;
exports.routeTemplateServiceInstance = new RouteTemplateService();
//# sourceMappingURL=RouteTemplateService.js.map