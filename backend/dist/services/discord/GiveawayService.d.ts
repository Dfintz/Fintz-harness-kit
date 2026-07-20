import { ActionRowBuilder, ButtonBuilder, Client, EmbedBuilder, GuildMember } from 'discord.js';
export interface GiveawayEntry {
    userId: string;
    username: string;
    enteredAt: Date;
}
export interface Giveaway {
    id: string;
    guildId: string;
    channelId: string;
    messageId: string;
    hostId: string;
    hostName: string;
    title: string;
    description: string;
    winners: number;
    requiredRoleId?: string;
    endsAt: Date;
    entries: GiveawayEntry[];
    ended: boolean;
    winnerIds: string[];
}
export interface CreateGiveawayOptions {
    guildId: string;
    channelId: string;
    hostId: string;
    hostName: string;
    title: string;
    description: string;
    winners: number;
    durationMinutes: number;
    requiredRoleId?: string;
}
export declare class GiveawayService {
    private static instance;
    private client;
    private readonly giveaways;
    private readonly timerIds;
    private readonly cleanupTimers;
    private idCounter;
    private static readonly MAX_GIVEAWAYS_PER_GUILD;
    private static readonly CLEANUP_DELAY_MS;
    static getInstance(): GiveawayService;
    initialize(client: Client): void;
    private loadFromRedis;
    private persistGiveaway;
    private unpersistGiveaway;
    createGiveaway(options: CreateGiveawayOptions): Giveaway | string;
    setMessageId(giveawayId: string, messageId: string): void;
    addEntry(giveawayId: string, userId: string, username: string, member?: GuildMember): Promise<string | null>;
    endGiveaway(giveawayId: string): Promise<string[]>;
    getGiveaway(giveawayId: string): Giveaway | undefined;
    listGiveaways(guildId: string): Giveaway[];
    buildGiveawayEmbed(giveaway: Giveaway): EmbedBuilder;
    buildGiveawayButtons(giveawayId: string, ended: boolean): ActionRowBuilder<ButtonBuilder>;
    private updateGiveawayMessage;
    shutdown(): void;
}
//# sourceMappingURL=GiveawayService.d.ts.map