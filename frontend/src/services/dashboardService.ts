import { logger } from '@/utils/logger';
import { apiClient } from './apiClient';

export interface DashboardStats {
  members: {
    total: number;
    active: number;
    online: number;
  };
  fleets: {
    total: number;
    ships: number;
    active: number;
  };
  alliances: {
    count: number;
    friendly: number;
  };
  inventory: {
    items: number;
    totalValue: number;
  };
  trading: {
    activeRoutes: number;
    totalProfit: number;
  };
}

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user?: {
    id: string;
    name: string;
  };
}

class DashboardService {
  async getStats(organizationId: string, _skipCache: boolean = false): Promise<DashboardStats> {
    try {
      const response = await apiClient.get<DashboardStats>(
        `/api/v2/organizations/${organizationId}/dashboard`
      );
      return response.data;
    } catch (error) {
      // Fallback to aggregating from multiple endpoints if dashboard endpoint doesn't exist yet
      logger.warn('Dashboard stats endpoint not available, using fallback');
      return this.getStatsFallback(organizationId);
    }
  }

  private async getStatsFallback(_organizationId: string): Promise<DashboardStats> {
    try {
      // Try to fetch from individual endpoints
      const [fleetsResponse] = await Promise.allSettled([
        apiClient.get('/api/v2/fleets/statistics'),
      ]);

      const fleetStats = fleetsResponse.status === 'fulfilled' ? fleetsResponse.value.data : null;

      return {
        members: {
          total: 0,
          active: 0,
          online: 0,
        },
        fleets: {
          total: (fleetStats as Record<string, number> | null)?.totalFleets || 0,
          ships: (fleetStats as Record<string, number> | null)?.totalShips || 0,
          active: (fleetStats as Record<string, number> | null)?.totalFleets || 0,
        },
        alliances: {
          count: 0,
          friendly: 0,
        },
        inventory: {
          items: 0,
          totalValue: 0,
        },
        trading: {
          activeRoutes: 0,
          totalProfit: 0,
        },
      };
    } catch (error) {
      logger.error(
        'Failed to fetch fallback stats:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async getRecentActivity(organizationId: string, limit: number = 10): Promise<RecentActivity[]> {
    try {
      const response = await apiClient.get<RecentActivity[]>(
        `/api/v2/organizations/${organizationId}/feed`,
        {
          params: { limit },
        }
      );
      return response.data;
    } catch (error) {
      logger.warn('Recent activity endpoint not available yet');
      return [];
    }
  }

  async getUpcomingEvents(organizationId: string): Promise<unknown[]> {
    try {
      const response = await apiClient.get<unknown[]>(`/api/v2/activities`, {
        params: {
          organizationId,
          status: 'scheduled',
          sort: 'startDate',
          limit: 5,
        },
      });
      return response.data;
    } catch (error) {
      logger.warn('Activities endpoint error:', error);
      return [];
    }
  }
}

export const dashboardService = new DashboardService();
