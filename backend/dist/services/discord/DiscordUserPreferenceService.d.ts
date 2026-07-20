import { DiscordUserPreference } from '../../models/DiscordUserPreference';
export declare class DiscordUserPreferenceService {
    private static instance;
    private readonly repo;
    constructor();
    static getInstance(): DiscordUserPreferenceService;
    getOrCreate(userId: string, guildId: string): Promise<DiscordUserPreference>;
    get(userId: string, guildId: string): Promise<DiscordUserPreference | null>;
    update(userId: string, guildId: string, updates: Partial<Pick<DiscordUserPreference, 'dmEnabled' | 'lfgPingOptIn' | 'eventReminderOptIn' | 'ticketDmOptIn' | 'recruitmentDmOptIn' | 'moderationAlertOptIn' | 'botResponseViaDm' | 'timezone'>>): Promise<DiscordUserPreference>;
    isDmEnabled(userId: string, guildId: string): Promise<boolean>;
    filterDmEnabled(userIds: string[], guildId: string): Promise<Set<string>>;
    getGuildPreferences(guildId: string): Promise<DiscordUserPreference[]>;
}
export declare const discordUserPreferenceService: DiscordUserPreferenceService;
//# sourceMappingURL=DiscordUserPreferenceService.d.ts.map