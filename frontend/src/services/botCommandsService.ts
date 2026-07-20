import { apiClient } from './apiClient';
import { BaseService } from './baseService';

export interface CommandDocOption {
  name: string;
  description: string;
  type: string;
  required: boolean;
  choices?: Array<{ name: string; value: string }>;
}

export interface CommandDocSubcommand {
  name: string;
  description: string;
  options: CommandDocOption[];
}

export interface CommandDoc {
  name: string;
  description: string;
  category: string;
  examples: string[];
  permissions: string[];
  guildOnly: boolean;
  cooldown: number;
  subcommands: CommandDocSubcommand[];
  options: CommandDocOption[];
}

export interface BotCommandsResponse {
  data: CommandDoc[];
  meta: {
    total: number;
    categories: string[];
  };
}

class BotCommandsService extends BaseService {
  protected basePath = '/api/v2/bot';

  async getCommands(category?: string): Promise<BotCommandsResponse> {
    try {
      this.log('getCommands', { category });
      const query = category ? `?category=${encodeURIComponent(category)}` : '';
      const response = await apiClient.get<BotCommandsResponse>(
        `${this.basePath}/commands${query}`
      );
      // Bot commands endpoint returns { data, meta } directly (not V2 envelope),
      // so we return the response as-is without unwrapping .data
      return response as unknown as BotCommandsResponse;
    } catch (error) {
      this.handleError(error, 'getCommands');
    }
  }
}

export const botCommandsService = new BotCommandsService();
