import type {
  CommandSummary,
  OperationCommand,
  OperationCommandChain,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService, extractData } from './baseService';

/**
 * Operation Command Service
 *
 * Handles chain-of-command and command broadcast API calls.
 * Voice-command-friendly for Wingman AI integration.
 */
class OperationCommandService extends BaseService {
  protected basePath = '/api/v2/activities';

  // ===== Command Chain =====

  async setCommandChain(
    activityId: string,
    data: {
      fleetCommanders: Array<{
        userId: string;
        userName: string;
        fleetId?: string;
        fleetName?: string;
      }>;
      squadronLeaders?: Array<{
        userId: string;
        userName: string;
        squadronName: string;
        reportsToUserId: string;
      }>;
    }
  ): Promise<OperationCommandChain> {
    try {
      this.log('setCommandChain', { activityId });
      const response = await apiClient.post<OperationCommandChain>(
        `${this.basePath}/${activityId}/command-chain`,
        data
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'setCommandChain');
    }
  }

  async getCommandChain(activityId: string): Promise<{ chain: OperationCommandChain | null }> {
    try {
      this.log('getCommandChain', { activityId });
      const response = await apiClient.get<{ chain: OperationCommandChain | null }>(
        `${this.basePath}/${activityId}/command-chain`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getCommandChain');
    }
  }

  // ===== Commands =====

  async issueCommand(
    activityId: string,
    data: {
      type: string;
      priority?: string;
      message: string;
      targetScope: { type: string; fleetId?: string; squadronName?: string; userIds?: string[] };
      payload?: Record<string, unknown>;
    }
  ): Promise<{ id: string; type: string; status: string; recipientCount: number }> {
    try {
      this.log('issueCommand', { activityId, type: data.type });
      const response = await apiClient.post<{
        id: string;
        type: string;
        status: string;
        recipientCount: number;
      }>(`${this.basePath}/${activityId}/commands`, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'issueCommand');
    }
  }

  async getCommands(activityId: string): Promise<{ commands: CommandSummary[] }> {
    try {
      this.log('getCommands', { activityId });
      const response = await apiClient.get<{ commands: CommandSummary[] }>(
        `${this.basePath}/${activityId}/commands`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getCommands');
    }
  }

  async getCommand(activityId: string, commandId: string): Promise<OperationCommand> {
    try {
      this.log('getCommand', { activityId, commandId });
      const response = await apiClient.get<OperationCommand>(
        `${this.basePath}/${activityId}/commands/${commandId}`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getCommand');
    }
  }

  async acknowledgeCommand(
    activityId: string,
    commandId: string,
    response?: string
  ): Promise<{ commandId: string; status: string; allAcknowledged: boolean }> {
    try {
      this.log('acknowledgeCommand', { activityId, commandId });
      const res = await apiClient.post<{
        commandId: string;
        status: string;
        allAcknowledged: boolean;
      }>(`${this.basePath}/${activityId}/commands/${commandId}/ack`, { response });
      return extractData(res);
    } catch (error) {
      return this.handleError(error, 'acknowledgeCommand');
    }
  }

  // ===== Pre-flight Check =====

  async issuePreflightCheck(
    activityId: string
  ): Promise<{ id: string; type: string; recipientCount: number }> {
    try {
      this.log('issuePreflightCheck', { activityId });
      const response = await apiClient.post<{ id: string; type: string; recipientCount: number }>(
        `${this.basePath}/${activityId}/preflight-check`,
        {}
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'issuePreflightCheck');
    }
  }
}

export const operationCommandService = new OperationCommandService();
