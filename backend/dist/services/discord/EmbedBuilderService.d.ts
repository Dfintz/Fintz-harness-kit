import { EmbedBuilder } from 'discord.js';
import { ShortcodeContext } from './ShortcodeEngine';
export type { ShortcodeContext };
export interface SavedEmbed {
    id: string;
    guildId: string;
    name: string;
    title?: string;
    description?: string;
    color?: number;
    footerText?: string;
    thumbnailUrl?: string;
    imageUrl?: string;
    fields: EmbedFieldDef[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface EmbedFieldDef {
    name: string;
    value: string;
    inline?: boolean;
}
export declare class EmbedBuilderService {
    private static instance;
    private readonly embeds;
    private readonly shortcodeEngine;
    private idCounter;
    static getInstance(): EmbedBuilderService;
    initialize(): void;
    private loadFromRedis;
    private persistEmbed;
    private unpersistEmbed;
    createEmbed(guildId: string, name: string, options: {
        title?: string;
        description?: string;
        color?: number;
        footerText?: string;
        thumbnailUrl?: string;
        imageUrl?: string;
        fields?: EmbedFieldDef[];
    }, createdBy: string): SavedEmbed | string;
    updateEmbed(embedId: string, updates: Partial<Omit<SavedEmbed, 'id' | 'guildId' | 'createdBy' | 'createdAt'>>): SavedEmbed | null;
    findByName(guildId: string, name: string): SavedEmbed | undefined;
    getEmbed(embedId: string): SavedEmbed | undefined;
    listEmbeds(guildId: string): SavedEmbed[];
    deleteEmbed(embedId: string): boolean;
    buildDiscordEmbed(saved: SavedEmbed, context?: ShortcodeContext): EmbedBuilder;
    renderWithContext(title: string | undefined, description: string | undefined, context: ShortcodeContext): {
        title?: string;
        description?: string;
    };
    resolveFooterText(text: string | undefined, context: ShortcodeContext): string | undefined;
    resolveAuthorName(name: string | undefined, context: ShortcodeContext): string | undefined;
    resolveFieldText(text: string | undefined, context: ShortcodeContext): string | undefined;
    private isValidUrl;
}
//# sourceMappingURL=EmbedBuilderService.d.ts.map