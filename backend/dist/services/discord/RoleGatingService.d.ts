import { GuildMember } from 'discord.js';
export interface RoleGateRule {
    action: 'apply' | 'create_ticket' | 'join_event' | 'create_lfg' | 'giveaway';
    requiredRoleIds: string[];
    restrictedRoleIds: string[];
    denyMessage?: string;
}
export interface RoleGatingSettings {
    enabled: boolean;
    rules: RoleGateRule[];
}
export declare const DEFAULT_ROLE_GATING: RoleGatingSettings;
export interface GateCheckResult {
    allowed: boolean;
    reason?: string;
}
export declare class RoleGatingService {
    private static instance;
    private readonly settingsService;
    static getInstance(): RoleGatingService;
    checkGate(guildId: string, member: GuildMember, action: RoleGateRule['action']): Promise<GateCheckResult>;
}
//# sourceMappingURL=RoleGatingService.d.ts.map