import { ActionRowBuilder, ButtonBuilder, Client, EmbedBuilder, GuildMember } from 'discord.js';
export interface RoleOption {
    roleId: string;
    label: string;
    emoji?: string;
    description?: string;
}
export interface ReactionRolePanel {
    id: string;
    guildId: string;
    channelId: string;
    messageId: string;
    title: string;
    description: string;
    roles: RoleOption[];
    exclusive: boolean;
    createdBy: string;
}
export declare class ReactionRoleService {
    private static instance;
    private client;
    private readonly panels;
    private idCounter;
    private static readonly MAX_PANELS_PER_GUILD;
    static getInstance(): ReactionRoleService;
    initialize(client: Client): void;
    private loadFromRedis;
    private persistPanel;
    private unpersistPanel;
    createPanel(guildId: string, channelId: string, title: string, description: string, roles: RoleOption[], exclusive: boolean, createdBy: string): ReactionRolePanel | string;
    setMessageId(panelId: string, messageId: string): void;
    handleRoleToggle(panelId: string, roleId: string, member: GuildMember): Promise<{
        action: 'added' | 'removed' | 'switched';
        roleName: string;
    } | string>;
    getPanel(panelId: string): ReactionRolePanel | undefined;
    findPanelByButton(customId: string): {
        panel: ReactionRolePanel;
        roleId: string;
    } | null;
    listPanels(guildId: string): ReactionRolePanel[];
    deletePanel(panelId: string): Promise<boolean>;
    buildPanelEmbed(panel: ReactionRolePanel): EmbedBuilder;
    buildPanelButtons(panel: ReactionRolePanel): ActionRowBuilder<ButtonBuilder>[];
}
//# sourceMappingURL=ReactionRoleService.d.ts.map