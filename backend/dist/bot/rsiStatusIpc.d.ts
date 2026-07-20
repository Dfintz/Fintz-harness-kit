import type { RsiStatusPanelConfig } from './commands/rsistatus';
import type { GuildStatusChannels, StatusRole } from './commands/rsiStatusChannels';
export declare const RSI_STATUS_IPC_ACTIONS: {
    readonly GET_PANEL: "rsi-status:panel:get";
    readonly DEPLOY_PANEL: "rsi-status:panel:deploy";
    readonly REMOVE_PANEL: "rsi-status:panel:remove";
    readonly GET_CHANNELS: "rsi-status:channels:get";
    readonly CREATE_MANAGED_CHANNELS: "rsi-status:channels:create-managed";
    readonly ASSIGN_CHANNEL: "rsi-status:channels:assign";
    readonly REMOVE_CHANNELS: "rsi-status:channels:remove";
};
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
//# sourceMappingURL=rsiStatusIpc.d.ts.map