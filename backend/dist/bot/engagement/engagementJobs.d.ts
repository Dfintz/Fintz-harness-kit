import { Client } from 'discord.js';
export declare class StatRoleEvaluationJob {
    private tasks;
    private readonly client;
    private readonly statRoleService;
    constructor(client: Client);
    start(): void;
    stop(): void;
    evaluateAll(): Promise<void>;
    private evaluateGuild;
    private applyRoleChanges;
}
export declare class ChannelCounterUpdateJob {
    private tasks;
    private readonly client;
    private readonly counterService;
    constructor(client: Client);
    start(): void;
    stop(): void;
    updateAll(): Promise<void>;
}
export declare class EngagementCleanupJob {
    private tasks;
    start(): void;
    stop(): void;
    private cleanup;
}
//# sourceMappingURL=engagementJobs.d.ts.map