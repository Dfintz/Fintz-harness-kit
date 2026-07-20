import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ==================== Types ====================

export interface CommandStats {
  commandName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  uniqueUsers: number;
  uniqueGuilds: number;
  lastUsed: string;
}

export interface SystemStats {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageExecutionTime: number;
  uniqueUsers: number;
  uniqueGuilds: number;
  topCommands: Array<{ commandName: string; count: number }>;
  dateRange: { from: string; to: string };
}

export interface GuildCommandStats {
  guildId: string;
  totalCommands: number;
  uniqueUsers: number;
  commandBreakdown: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
}

export interface GuildGameStats {
  guildId: string;
  currentPlayers: Record<string, number>;
  playersByGame: Record<string, string[]>;
  statusCounts: {
    online: number;
    idle: number;
    dnd: number;
    offline: number;
  };
}

export interface ActivityDataPoint {
  hour: number;
  dayOfWeek: number;
  count: number;
}

export interface GamePresenceHistory {
  gameName: string;
  totalSessions: number;
  uniquePlayers: number;
  hourlyActivity: ActivityDataPoint[];
}

// ==================== Service ====================

class BotStatsService extends BaseService {
  protected basePath = '/api/v2/analytics/bot-stats';

  async getSystemCommandStats(): Promise<SystemStats> {
    try {
      this.log('getSystemCommandStats');
      const response = await apiClient.get<SystemStats>(`${this.basePath}/commands`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getSystemCommandStats');
    }
  }

  async getGuildCommandStats(guildId: string): Promise<GuildCommandStats> {
    try {
      this.log('getGuildCommandStats', { guildId });
      const response = await apiClient.get<GuildCommandStats>(`${this.basePath}/commands`, {
        params: { guildId },
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getGuildCommandStats');
    }
  }

  async getAllCommandStats(): Promise<CommandStats[]> {
    try {
      this.log('getAllCommandStats');
      const response = await apiClient.get<CommandStats[]>(`${this.basePath}/commands/all`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getAllCommandStats');
    }
  }

  async getPresenceStats(guildId: string): Promise<GuildGameStats> {
    try {
      this.log('getPresenceStats', { guildId });
      const response = await apiClient.get<GuildGameStats>(`${this.basePath}/presence/${guildId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getPresenceStats');
    }
  }

  async getActivityHeatmap(guildId: string, days = 7): Promise<ActivityDataPoint[]> {
    try {
      this.log('getActivityHeatmap', { guildId, days });
      const response = await apiClient.get<ActivityDataPoint[]>(
        `${this.basePath}/heatmap/${guildId}`,
        { params: { days } }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getActivityHeatmap');
    }
  }

  async getGameHistory(guildId: string, days = 7): Promise<GamePresenceHistory[]> {
    try {
      this.log('getGameHistory', { guildId, days });
      const response = await apiClient.get<GamePresenceHistory[]>(
        `${this.basePath}/games/${guildId}`,
        { params: { days } }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getGameHistory');
    }
  }
}

export const botStatsService = new BotStatsService();
