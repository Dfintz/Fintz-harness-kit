import { type RsiStatusSnapshot } from '../../services/external/RsiStatusService';
import { BotCommand } from './types';
export declare function parseRsiStatusChannelAction(customId: string): 'create' | 'remove' | null;
export interface RsiStatusPanelConfig {
    channelId: string;
    messageId: string;
}
export declare function buildPanelSnapshotSignature(status: RsiStatusSnapshot): string;
export declare function shouldDropPanelTrackingForError(error: unknown): boolean;
export declare function restorePanelEntry(guildId: string, json: string): Promise<boolean>;
export declare function getRsiStatusPanelForGuild(guildId: string): Promise<RsiStatusPanelConfig | null>;
export declare function deployRsiStatusPanelForGuild(guildId: string, channelId: string): Promise<RsiStatusPanelConfig>;
export declare function removeRsiStatusPanelForGuild(guildId: string): Promise<boolean>;
export declare function restoreRsiStatusPanels(): Promise<void>;
export declare function restoreRsiStatusChannels(): Promise<void>;
export declare const rsistatus: BotCommand;
//# sourceMappingURL=rsistatus.d.ts.map