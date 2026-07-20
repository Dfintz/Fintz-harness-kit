import { ButtonInteraction, ChannelSelectMenuInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder, StringSelectMenuInteraction } from 'discord.js';
import type { InteractionDeferMode } from '../utils/deferInteraction';
export interface BotCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    cooldown?: number;
    defer?: InteractionDeferMode;
    category?: 'utility' | 'events' | 'organization' | 'social' | 'voice' | 'admin' | 'moderation';
    examples?: string[];
    permissions?: string[];
    guildOnly?: boolean;
    handleButton?: (interaction: ButtonInteraction) => Promise<void>;
    handleModal?: (interaction: ModalSubmitInteraction) => Promise<void>;
    handleSelectMenu?: (interaction: StringSelectMenuInteraction) => Promise<void>;
    handleChannelSelectMenu?: (interaction: ChannelSelectMenuInteraction) => Promise<void>;
}
//# sourceMappingURL=types.d.ts.map