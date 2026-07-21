import { TradeStop } from '../../../models/TradingRoute';

import { CreateTradingRouteDto } from './TradingService';

/**
 * Trading Route Template
 * Pre-defined trading routes for common trade scenarios
 */
export interface RouteTemplate {
  id: string;
  name: string;
  description: string;
  category: RouteCategory;
  difficulty: RouteDifficulty;
  estimatedProfit: number;
  estimatedDuration: number; // minutes
  minCargoCapacity: number; // SCU
  riskLevel: RiskLevel;
  stops: TradeStop[];
  tags: string[];
  requirements?: string[];
  tips?: string[];
}

export enum RouteCategory {
  MINING = 'mining',
  COMMODITY = 'commodity',
  MEDICAL = 'medical',
  ILLEGAL = 'illegal',
  HIGH_VALUE = 'high_value',
  BULK = 'bulk',
  BEGINNER = 'beginner',
}

export enum RouteDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EXTREME = 'extreme',
}

/**
 * Pre-defined route templates for Star Citizen trading
 */
export const ROUTE_TEMPLATES: RouteTemplate[] = [
  // Beginner Routes
  {
    id: 'beginner-laranite-run',
    name: 'Beginner Laranite Run',
    description:
      'A safe and profitable route for new traders. Buy Laranite at mining outposts and sell at major landing zones.',
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

  // Mining Routes
  {
    id: 'mining-agricium-circuit',
    name: 'Agricium Mining Circuit',
    description:
      'Collect Agricium from mining facilities and sell at the best prices. Moderate risk.',
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

  // Commodity Routes
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

  // High Value Routes
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

  // Bulk Routes
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

/**
 * Route Template Service
 * Provides access to pre-defined trading route templates
 */
export class RouteTemplateService {
  /**
   * Get all available route templates
   */
  public getAllTemplates(): RouteTemplate[] {
    return ROUTE_TEMPLATES;
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: RouteCategory): RouteTemplate[] {
    return ROUTE_TEMPLATES.filter(t => t.category === category);
  }

  /**
   * Get templates by difficulty
   */
  public getTemplatesByDifficulty(difficulty: RouteDifficulty): RouteTemplate[] {
    return ROUTE_TEMPLATES.filter(t => t.difficulty === difficulty);
  }

  /**
   * Get templates by risk level
   */
  public getTemplatesByRiskLevel(riskLevel: RiskLevel): RouteTemplate[] {
    return ROUTE_TEMPLATES.filter(t => t.riskLevel === riskLevel);
  }

  /**
   * Get templates suitable for a given cargo capacity
   */
  public getTemplatesForCargoCapacity(cargoCapacity: number): RouteTemplate[] {
    return ROUTE_TEMPLATES.filter(t => t.minCargoCapacity <= cargoCapacity);
  }

  /**
   * Get template by ID
   */
  public getTemplateById(id: string): RouteTemplate | undefined {
    return ROUTE_TEMPLATES.find(t => t.id === id);
  }

  /**
   * Search templates by tag
   */
  public searchByTag(tag: string): RouteTemplate[] {
    const normalizedTag = tag.toLowerCase();
    return ROUTE_TEMPLATES.filter(t =>
      t.tags.some(tTag => tTag.toLowerCase().includes(normalizedTag))
    );
  }

  /**
   * Convert template to CreateTradingRouteDto
   */
  public templateToDto(
    template: RouteTemplate,
    creatorId: string,
    organizationId: string
  ): CreateTradingRouteDto {
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

  /**
   * Get beginner-friendly templates
   */
  public getBeginnerTemplates(): RouteTemplate[] {
    return ROUTE_TEMPLATES.filter(
      t => t.difficulty === RouteDifficulty.EASY || t.category === RouteCategory.BEGINNER
    );
  }

  /**
   * Get most profitable templates
   */
  public getMostProfitableTemplates(limit: number = 5): RouteTemplate[] {
    return [...ROUTE_TEMPLATES]
      .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
      .slice(0, limit);
  }

  /**
   * Get fastest templates
   */
  public getFastestTemplates(limit: number = 5): RouteTemplate[] {
    return [...ROUTE_TEMPLATES]
      .sort((a, b) => a.estimatedDuration - b.estimatedDuration)
      .slice(0, limit);
  }

  /**
   * Get templates with best profit per minute
   */
  public getBestProfitPerMinute(limit: number = 5): RouteTemplate[] {
    return [...ROUTE_TEMPLATES]
      .map(t => ({
        ...t,
        profitPerMinute: t.estimatedProfit / t.estimatedDuration,
      }))
      .sort((a, b) => b.profitPerMinute - a.profitPerMinute)
      .slice(0, limit);
  }
}

export const routeTemplateServiceInstance = new RouteTemplateService();

