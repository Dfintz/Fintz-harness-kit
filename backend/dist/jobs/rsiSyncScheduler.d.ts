import { Client } from 'discord.js';
export declare const startRsiSyncSchedulerJob: (client?: Client) => void;
export declare const setRsiSyncSchedulerClient: (client: Client) => void;
export declare function runPostSyncIntel(organizationId: string, guildId?: string): Promise<void>;
export declare const triggerManualSync: (organizationId: string, triggeredBy?: string) => Promise<void>;
//# sourceMappingURL=rsiSyncScheduler.d.ts.map