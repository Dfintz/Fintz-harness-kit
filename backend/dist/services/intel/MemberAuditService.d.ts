import { CreateManualFlagDto, CreateMemberFlagDto, ListFlagsQuery, MemberFlagSummary, ResolveFlagDto, UserFlagStats } from '@sc-fleet-manager/shared-types';
import { MemberAuditEvent } from '../../models/MemberAuditEvent';
export interface PaginatedFlags {
    data: MemberFlagSummary[];
    pagination: {
        total: number;
        count: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
        totalPages: number;
    };
}
export declare class MemberAuditService {
    private readonly flagRepo;
    private readonly watchlistRepo;
    private subscribed;
    constructor();
    subscribeToEvents(): void;
    private onDiscordLeft;
    private onDiscordRoleChanged;
    private onDiscordTimeout;
    private onRsiOrgLeft;
    private onRsiOrgJoined;
    private onRsiRankChanged;
    private onModerationAction;
    private onPrimaryOrgSwitched;
    private onPlatformLeft;
    private onRsiSyncFailed;
    private onRsiHandleChanged;
    private onRsiOrgDissolved;
    private onDiscordUnlinked;
    private onTeamMemberRemoved;
    private onTeamDeleted;
    private onActivityCancelled;
    createFlag(dto: CreateMemberFlagDto): Promise<MemberAuditEvent>;
    createManualFlag(organizationId: string, targetUserId: string, officerId: string, dto: CreateManualFlagDto): Promise<MemberAuditEvent>;
    getFlagById(organizationId: string, flagId: string): Promise<MemberAuditEvent | null>;
    listFlags(organizationId: string, query?: ListFlagsQuery): Promise<PaginatedFlags>;
    resolveFlag(organizationId: string, flagId: string, officerId: string, dto: ResolveFlagDto): Promise<MemberAuditEvent>;
    getUserFlagStats(organizationId: string, userId: string): Promise<UserFlagStats>;
    private findWatchlistEntry;
    private moderationSeverityToFlag;
    private buildTimeoutDescription;
    private buildModerationDescription;
    private buildRoleChangeDescription;
    toSummary(flag: MemberAuditEvent): MemberFlagSummary;
}
//# sourceMappingURL=MemberAuditService.d.ts.map