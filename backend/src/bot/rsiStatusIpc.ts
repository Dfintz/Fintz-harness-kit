import type { RsiStatusPanelConfig } from './commands/rsistatus';
import type { GuildStatusChannels, StatusRole } from './commands/rsiStatusChannels';

export const RSI_STATUS_IPC_ACTIONS = {
  GET_PANEL: 'rsi-status:panel:get',
  DEPLOY_PANEL: 'rsi-status:panel:deploy',
  REMOVE_PANEL: 'rsi-status:panel:remove',
  GET_CHANNELS: 'rsi-status:channels:get',
  CREATE_MANAGED_CHANNELS: 'rsi-status:channels:create-managed',
  ASSIGN_CHANNEL: 'rsi-status:channels:assign',
  REMOVE_CHANNELS: 'rsi-status:channels:remove',
} as const;

export interface RsiStatusPanelGetResponse {
  panel: RsiStatusPanelConfig | null;
}

export interface RsiStatusPanelDeployResponse {
  panel: RsiStatusPanelConfig;
}

export interface RsiStatusPanelRemoveResponse {
  removed: boolean;
}

export interface RsiStatusChannelsGetResponse {
  channels: GuildStatusChannels | null;
}

export interface RsiStatusChannelsAssignPayload {
  guildId: string;
  role: StatusRole;
  channelId: string;
}

export interface RsiStatusChannelsRemoveResponse {
  removed: boolean;
}
