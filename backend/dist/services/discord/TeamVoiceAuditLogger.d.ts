import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum TeamVoiceAuditAction {
    CHANNELS_CREATED = "TEAM_VOICE_CHANNELS_CREATED",
    CHANNELS_DELETED = "TEAM_VOICE_CHANNELS_DELETED",
    MEMBER_ADDED = "TEAM_VOICE_MEMBER_ADDED",
    MEMBER_REMOVED = "TEAM_VOICE_MEMBER_REMOVED"
}
export interface TeamVoiceAuditEntry extends BaseDomainAuditEntry<TeamVoiceAuditAction> {
    teamId: string;
    teamName?: string;
    guildId?: string;
}
export declare class TeamVoiceAuditLogger extends DomainAuditLogger<TeamVoiceAuditAction, TeamVoiceAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): TeamVoiceAuditLogger;
    protected buildMessage(entry: TeamVoiceAuditEntry): string;
    protected buildResource(entry: TeamVoiceAuditEntry): string;
    logChannelsCreated(organizationId: string, teamId: string, teamName: string, guildId: string, performedById: string): void;
    logChannelsDeleted(organizationId: string, teamId: string, guildId: string): void;
    logMemberAdded(organizationId: string, teamId: string, userId: string, memberRole?: string): void;
    logMemberRemoved(organizationId: string, teamId: string, userId: string): void;
}
export declare const teamVoiceAuditLogger: TeamVoiceAuditLogger;
//# sourceMappingURL=TeamVoiceAuditLogger.d.ts.map