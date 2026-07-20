import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ==================== Types ====================

export interface TrendDataPoint {
  date: string;
  count: number;
}

export interface CrewFormationTrends {
  period: 'daily' | 'weekly' | 'monthly';
  trends: TrendDataPoint[];
  totalFormations: number;
  averagePerPeriod: number;
}

export interface FormationSpeedStats {
  averageMinutes: number;
  medianMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  distribution: Array<{ bucket: string; count: number }>;
}

export interface PlacementMetrics {
  totalJobs: number;
  completedJobs: number;
  placementRate: number;
  averagePlacementDays: number;
  byType: Array<{ type: string; total: number; completed: number; rate: number }>;
  trend: TrendDataPoint[];
}

export interface LfgConversionMetrics {
  totalLfg: number;
  converted: number;
  conversionRate: number;
  averageGroupSize: number;
  trend: TrendDataPoint[];
  byActivity: Array<{ activity: string; total: number; converted: number; rate: number }>;
}

export interface CrossSystemAnalytics {
  crewFormation: CrewFormationTrends;
  formationSpeed: FormationSpeedStats;
  jobPlacement: PlacementMetrics;
  lfgConversion: LfgConversionMetrics;
  generatedAt: string;
}

export interface CrossSystemAnalyticsParams {
  period?: 'daily' | 'weekly' | 'monthly';
  orgId?: string;
  startDate?: string;
  endDate?: string;
}

// ==================== Service ====================

class CrossSystemAnalyticsService extends BaseService {
  protected basePath = '/api/v2/analytics/cross-system';

  async getAnalytics(params?: CrossSystemAnalyticsParams): Promise<CrossSystemAnalytics> {
    try {
      this.log('getAnalytics', params);
      const response = await apiClient.get<CrossSystemAnalytics>(this.basePath, { params });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAnalytics');
    }
  }

  async getCrewFormationTrends(params?: CrossSystemAnalyticsParams): Promise<CrewFormationTrends> {
    try {
      this.log('getCrewFormationTrends', params);
      const response = await apiClient.get<CrewFormationTrends>(`${this.basePath}/crew-formation`, {
        params,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getCrewFormationTrends');
    }
  }

  async getFormationSpeedStats(params?: CrossSystemAnalyticsParams): Promise<FormationSpeedStats> {
    try {
      this.log('getFormationSpeedStats', params);
      const response = await apiClient.get<FormationSpeedStats>(
        `${this.basePath}/formation-speed`,
        { params }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getFormationSpeedStats');
    }
  }

  async getJobPlacementMetrics(params?: CrossSystemAnalyticsParams): Promise<PlacementMetrics> {
    try {
      this.log('getJobPlacementMetrics', params);
      const response = await apiClient.get<PlacementMetrics>(`${this.basePath}/job-placement`, {
        params,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getJobPlacementMetrics');
    }
  }

  async getLfgConversionMetrics(
    params?: CrossSystemAnalyticsParams
  ): Promise<LfgConversionMetrics> {
    try {
      this.log('getLfgConversionMetrics', params);
      const response = await apiClient.get<LfgConversionMetrics>(
        `${this.basePath}/lfg-conversion`,
        { params }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getLfgConversionMetrics');
    }
  }
}

export const crossSystemAnalyticsService = new CrossSystemAnalyticsService();
