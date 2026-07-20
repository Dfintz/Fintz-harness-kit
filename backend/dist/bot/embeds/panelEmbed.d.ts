import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputStyle } from 'discord.js';
export interface PanelButtonDef {
    action: string;
    label: string;
    style: ButtonStyle;
    emoji?: string;
    description: string;
}
export interface PanelModalFieldDef {
    customId: string;
    label: string;
    placeholder?: string;
    style: 'short' | 'paragraph' | TextInputStyle;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    value?: string;
}
export interface PanelConfig {
    title: string;
    description: string;
    color?: number;
    footer?: string;
    prefix: string;
    buttons: PanelButtonDef[];
}
export declare function buildPanelEmbed(config: PanelConfig): EmbedBuilder;
export declare function buildPanelButtons(config: PanelConfig): ActionRowBuilder<ButtonBuilder>;
export declare function parsePanelButtonId(customId: string): {
    prefix: string;
    action: string;
} | null;
export declare function buildPanelModal(customId: string, title: string, fields: PanelModalFieldDef[]): ModalBuilder;
//# sourceMappingURL=panelEmbed.d.ts.map