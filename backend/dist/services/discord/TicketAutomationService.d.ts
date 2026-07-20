import { Client } from 'discord.js';
export interface TicketAutomationRules {
    autoCloseInactiveHours?: number;
    autoDeleteResolvedDays?: number;
    autoEscalateHours?: number;
    notifyOnAutoClose?: boolean;
    notifyOnAutoEscalate?: boolean;
}
export declare const DEFAULT_AUTOMATION_RULES: TicketAutomationRules;
export interface TicketAutomationResult {
    autoClosed: number;
    autoEscalated: number;
    autoDeleted: number;
    errors: string[];
}
export declare class TicketAutomationService {
    private static instance;
    private readonly repo;
    private client;
    private constructor();
    static getInstance(): TicketAutomationService;
    initialize(client: Client): void;
    runForGuild(organizationId: string, guildId: string, rules: TicketAutomationRules): Promise<TicketAutomationResult>;
    private autoCloseInactive;
    private autoEscalateUnresponded;
    private autoDeleteResolved;
    private getLastActivityDate;
    private postChannelNotice;
}
export declare class TicketAutomationJob {
    private readonly client;
    private readonly tasks;
    constructor(client: Client);
    start(): void;
    stop(): void;
    private runAll;
}
//# sourceMappingURL=TicketAutomationService.d.ts.map