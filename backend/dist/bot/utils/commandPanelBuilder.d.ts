import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, type ColorResolvable, type InteractionReplyOptions } from 'discord.js';
export interface PanelButton {
    subcommand: string;
    label: string;
    emoji?: string;
    style?: ButtonStyle;
}
export interface CommandPanelConfig {
    prefix: string;
    title: string;
    description: string;
    color?: ColorResolvable;
    footer?: string;
    buttons: PanelButton[];
}
export declare function buildPanelCustomId(prefix: string, subcommand: string): string;
export declare function parsePanelCustomId(customId: string, prefix: string): string | null;
export declare function buildButton(customId: string, label: string, emoji: string, style?: ButtonStyle): ButtonBuilder;
export declare function buildRow(...buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>;
export declare function buildCommandPanel(config: CommandPanelConfig): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
};
export type CommandPanelReplyOptions = Omit<InteractionReplyOptions, 'embeds' | 'components'>;
export declare function replyWithCommandPanel(interaction: ChatInputCommandInteraction, config: CommandPanelConfig, replyOptions?: CommandPanelReplyOptions): Promise<void>;
export interface EphemeralPanelContent {
    title: string;
    description: string;
    rows?: ActionRowBuilder<ButtonBuilder>[];
    breadcrumb?: string[];
}
export declare function formatPanelBreadcrumb(trail: string[]): string;
export declare function buildPanelBackButton(customId: string, label?: string): ButtonBuilder;
export declare function stripLeadingPanelEmoji(title: string): string;
export interface SubpanelDecoration {
    breadcrumb: string[];
    backCustomId: string;
    backLabel?: string;
}
export declare function decorateSubpanel(panel: EphemeralPanelContent, decoration: SubpanelDecoration): EphemeralPanelContent;
export declare function buildEphemeralPanelEmbed(content: EphemeralPanelContent): EmbedBuilder;
export declare function replyEphemeralPanel(interaction: ButtonInteraction, content: EphemeralPanelContent): Promise<void>;
export declare function updateEphemeralPanel(interaction: ButtonInteraction, content: EphemeralPanelContent): Promise<void>;
//# sourceMappingURL=commandPanelBuilder.d.ts.map