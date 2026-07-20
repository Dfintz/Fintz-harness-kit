import { apiClient } from './apiClient';
import { BaseService } from './baseService';

export interface ShipComparisonScore {
  combat: number;
  cargo: number;
  speed: number;
  crew: number;
  value: number;
  overall: number;
}

export interface ShipComparisonRanking {
  [category: string]: number;
}

export interface ComparedShip {
  ship: {
    id: string;
    name: string;
    manufacturer?: string;
    model?: string;
    role?: string;
    size?: string;
    [key: string]: unknown;
  };
  scores: ShipComparisonScore;
  rankings: ShipComparisonRanking;
}

export interface ComparisonMetricValue {
  shipId: string;
  value: number | string | null;
  isWinner: boolean;
}

export interface ComparisonMetric {
  name: string;
  unit?: string;
  values: ComparisonMetricValue[];
  higherIsBetter: boolean;
}

export interface ComparisonCategory {
  name: string;
  metrics: ComparisonMetric[];
}

export interface ShipRecommendation {
  shipId: string;
  shipName: string;
  strength: string;
  reason: string;
}

export interface ComparisonSummary {
  totalShips: number;
  bestForCombat?: string;
  bestForCargo?: string;
  bestForSpeed?: string;
  bestValue?: string;
  recommendations: ShipRecommendation[];
}

export interface ShipComparisonResult {
  ships: ComparedShip[];
  categories: ComparisonCategory[];
  summary: ComparisonSummary;
}

export interface ShipRoleAnalysis {
  shipId: string;
  shipName: string;
  primaryRoles: string[];
  capabilities: Array<{
    role: string;
    score: number;
    description: string;
  }>;
  bestFor: string[];
  limitations: string[];
}

export interface FleetCompositionAnalysis {
  ships: Array<{
    id: string;
    name: string;
    role?: string;
    size?: string;
  }>;
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

export interface QuickComparisonResult {
  ship1: { id: string; name: string };
  ship2: { id: string; name: string };
  winner: string;
  breakdown: Array<{
    category: string;
    ship1Score: number;
    ship2Score: number;
    winner: string;
  }>;
}

class ShipComparisonService extends BaseService {
  protected basePath = '/api/v2/ships';

  async compareShips(shipIds: string[]): Promise<ShipComparisonResult> {
    try {
      this.log('compareShips', { shipIds });
      const response = await apiClient.post<ShipComparisonResult>(`${this.basePath}/compare`, {
        shipIds,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'compareShips');
    }
  }

  async quickCompare(shipId1: string, shipId2: string): Promise<QuickComparisonResult> {
    try {
      this.log('quickCompare', { shipId1, shipId2 });
      const response = await apiClient.post<QuickComparisonResult>(
        `${this.basePath}/quick-compare`,
        {
          shipId1,
          shipId2,
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'quickCompare');
    }
  }

  async getShipRoleAnalysis(shipId: string): Promise<ShipRoleAnalysis> {
    try {
      this.log('getShipRoleAnalysis', { shipId });
      const response = await apiClient.get<ShipRoleAnalysis>(`${this.basePath}/${shipId}/roles`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getShipRoleAnalysis');
    }
  }

  async getSimilarShips(shipId: string, limit = 5): Promise<Array<{ id: string; name: string }>> {
    try {
      this.log('getSimilarShips', { shipId, limit });
      const response = await apiClient.get<Array<{ id: string; name: string }>>(
        `${this.basePath}/${shipId}/similar?limit=${limit}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getSimilarShips');
    }
  }

  async getFleetCompositionAnalysis(fleetId: string): Promise<FleetCompositionAnalysis> {
    try {
      this.log('getFleetCompositionAnalysis', { fleetId });
      const response = await apiClient.get<FleetCompositionAnalysis>(
        `/api/v2/fleets/${fleetId}/ship-analysis`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getFleetCompositionAnalysis');
    }
  }
}

export const shipComparisonService = new ShipComparisonService();
