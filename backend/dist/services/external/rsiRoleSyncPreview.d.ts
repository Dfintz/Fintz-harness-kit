import type { RsiRoleMapping } from '../../models/RsiRoleMapping';
export interface RoleSyncPreviewEntry {
    mappingId: string;
    rsiRank: string;
    isActive: boolean;
    priority: number;
    discordRoleId: string | null;
    internalRoleId: string | null;
    internalRoleName: string | null;
    permissions: string[];
    affectedMemberCount: number | null;
}
export type RoleSyncPreviewWarningType = 'unmapped_rank' | 'inactive_mapping' | 'duplicate_discord_role' | 'missing_internal_role' | 'rank_no_members';
export interface RoleSyncPreviewWarning {
    type: RoleSyncPreviewWarningType;
    message: string;
    rsiRank?: string;
    discordRoleId?: string;
    memberCount?: number;
}
export interface RoleSyncPreview {
    entries: RoleSyncPreviewEntry[];
    warnings: RoleSyncPreviewWarning[];
    summary: {
        totalMappings: number;
        activeMappings: number;
        mappedRankCount: number;
        unmappedRankCount: number;
        knownAffectedMemberCount: number;
        unmappedMemberCount: number;
        coveragePercent: number | null;
    };
}
export interface DiscoveredRankCounts {
    rankMap: Array<{
        stars: number;
        name: string;
        count: number;
    }>;
}
export declare function buildRoleSyncPreview(mappings: RsiRoleMapping[], discovered: DiscoveredRankCounts, roleNameById: Map<string, string>): RoleSyncPreview;
//# sourceMappingURL=rsiRoleSyncPreview.d.ts.map