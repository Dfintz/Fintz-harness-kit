import { Ship } from '../../models/Ship';
export interface ShipComparisonResult {
    ships: ShipComparisonData[];
    categories: ComparisonCategory[];
    summary: ComparisonSummary;
}
export interface ShipComparisonData {
    ship: Ship;
    scores: {
        combat: number;
        cargo: number;
        speed: number;
        crew: number;
        value: number;
        overall: number;
    };
    rankings: {
        [category: string]: number;
    };
}
export interface ComparisonCategory {
    name: string;
    metrics: ComparisonMetric[];
}
export interface ComparisonMetric {
    name: string;
    unit?: string;
    values: {
        shipId: string;
        value: number | string | null;
        isWinner: boolean;
    }[];
    higherIsBetter: boolean;
}
export interface ComparisonSummary {
    totalShips: number;
    bestForCombat?: string;
    bestForCargo?: string;
    bestForSpeed?: string;
    bestValue?: string;
    recommendations: ShipRecommendation[];
}
export interface ShipRecommendation {
    shipId: string;
    shipName: string;
    strength: string;
    reason: string;
}
export interface ShipRoleAnalysis {
    shipId: string;
    shipName: string;
    primaryRoles: string[];
    capabilities: {
        role: string;
        score: number;
        description: string;
    }[];
    bestFor: string[];
    limitations: string[];
}
export interface FleetCompositionAnalysis {
    ships: Ship[];
    roleDistribution: Record<string, number>;
    sizeDistribution: Record<string, number>;
    capabilities: {
        hasCombat: boolean;
        hasCargo: boolean;
        hasExploration: boolean;
        hasMining: boolean;
        hasMedical: boolean;
        hasMultiCrew: boolean;
    };
    gaps: string[];
    recommendations: string[];
    overallScore: number;
}
export declare class ShipComparisonService {
    private shipRepository;
    compareShips(shipIds: string[]): Promise<ShipComparisonResult>;
    private calculateShipScores;
    private calculateCombatScore;
    private calculateCargoScore;
    private calculateSpeedScore;
    private calculateCrewScore;
    private calculateValueScore;
    private calculateRankings;
    private buildComparisonCategories;
    private buildMetric;
    private buildComparisonSummary;
    analyzeShipRoles(shipId: string): Promise<ShipRoleAnalysis>;
    analyzeFleetComposition(shipIds: string[]): Promise<FleetCompositionAnalysis>;
    getSimilarShips(shipId: string, limit?: number): Promise<Ship[]>;
    quickCompare(shipId1: string, shipId2: string): Promise<{
        ship1: Ship;
        ship2: Ship;
        winner: string;
        breakdown: {
            category: string;
            ship1Score: number;
            ship2Score: number;
            winner: string;
        }[];
    }>;
}
//# sourceMappingURL=ShipComparisonService.d.ts.map