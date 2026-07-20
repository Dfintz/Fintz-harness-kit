import type { AuditRunResult, BatchEnrichmentResult, ClearCacheResult, EnrichmentResult, LinkCandidate, ManualLinkInput, ManualLinkResult, MemberIntelCard, MemberIntelSummary, RoleMappingValidationResult } from './RsiMemberIntelService.types';
export type { AuditRunResult, BatchEnrichmentResult, ClearCacheResult, EnrichmentResult, LinkCandidate, ManualLinkInput, ManualLinkResult, MemberIntelCard, MemberIntelSummary, RoleMappingMismatch, RoleMappingValidationResult, } from './RsiMemberIntelService.types';
export declare class RsiMemberIntelService {
    private crawledMemberRepo;
    private citizenOrgRepo;
    private userLinkRepo;
    private membershipRepo;
    private roleMappingRepo;
    private flagRepo;
    private scheduleRepo;
    private userRepo;
    private memberCacheRepo;
    constructor();
    static readonly LIST_STATUS: {
        readonly OK: "ok";
        readonly NO_SCHEDULE: "no_schedule";
        readonly NO_MEMBERS: "no_members";
    };
    getMemberList(organizationId: string, rsiOrgSid?: string): Promise<{
        members: MemberIntelSummary[];
        status: string;
    }>;
    getMemberCard(organizationId: string, rsiHandle: string): Promise<MemberIntelCard | null>;
    enrichMember(organizationId: string, rsiHandle: string): Promise<EnrichmentResult>;
    enrichOrganizationMembers(organizationId: string): Promise<BatchEnrichmentResult>;
    runMemberAudit(organizationId: string, guildId?: string): Promise<AuditRunResult>;
    validateRoleMappings(organizationId: string, guildId?: string): Promise<RoleMappingValidationResult>;
    private resolveOrgSid;
    private resolveGuildId;
    private guildMemberNameMapCache;
    private fetchGuildMemberNameMap;
    private tryDiscordGuildNameMatch;
    private getActiveFlagCountsByUser;
    private getDiscordStatus;
    private validateMemberRoleMapping;
    suggestLinkCandidates(organizationId: string, query?: string): Promise<LinkCandidate[]>;
    manualLink(organizationId: string, rsiHandle: string, input: ManualLinkInput, performedBy: string): Promise<ManualLinkResult>;
    unlinkMember(organizationId: string, rsiHandle: string, performedBy: string): Promise<{
        success: boolean;
    }>;
    clearCache(organizationId: string, performedBy: string): Promise<ClearCacheResult>;
}
export declare const rsiMemberIntelService: RsiMemberIntelService;
//# sourceMappingURL=RsiMemberIntelService.d.ts.map