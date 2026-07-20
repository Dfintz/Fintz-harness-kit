import { Client, Presence } from 'discord.js';
export interface AutoLfgPreferences {
    maxPlayers: number;
}
export declare class LfgPresenceMonitor {
    private static instance;
    private readonly optIns;
    private readonly cooldowns;
    private cleanupInterval;
    private readonly lfgService;
    private constructor();
    static getInstance(): LfgPresenceMonitor;
    shutdown(): void;
    optIn(userId: string, guildId: string, prefs: AutoLfgPreferences): void;
    optOut(userId: string, guildId: string): void;
    isOptedIn(userId: string, guildId: string): boolean;
    hydrate(): Promise<void>;
    private persistOptIn;
    private unpersistOptIn;
    handlePresenceUpdate(oldPresence: Presence | null, newPresence: Presence, _client: Client): Promise<void>;
    cleanupCooldowns(): number;
}
//# sourceMappingURL=lfgPresenceMonitor.d.ts.map