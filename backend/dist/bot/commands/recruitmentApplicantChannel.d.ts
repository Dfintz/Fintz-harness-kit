import { type Guild, type ModalSubmitInteraction, type StringSelectMenuInteraction } from 'discord.js';
import type { DiscordGuildSettings } from '../../models/DiscordGuildSettings';
interface ApplicantChannelConfig {
    categoryId: string;
    roleId: string;
}
export declare function resolveApplicantChannelConfig(settingsRows: DiscordGuildSettings[] | null | undefined): ApplicantChannelConfig | null;
export declare function openApplicantChannel(interaction: ModalSubmitInteraction | StringSelectMenuInteraction, recruitmentId: string, application: Record<string, unknown>): Promise<void>;
export declare function closeApplicantChannel(guild: Guild | null, applicationId: string, reason: string): Promise<void>;
export {};
//# sourceMappingURL=recruitmentApplicantChannel.d.ts.map