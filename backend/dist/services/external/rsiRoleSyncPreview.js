"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRoleSyncPreview = buildRoleSyncPreview;
function buildRoleSyncPreview(mappings, discovered, roleNameById) {
    const countByRank = new Map();
    for (const row of discovered.rankMap) {
        countByRank.set(row.name, (countByRank.get(row.name) ?? 0) + row.count);
    }
    const ranksWithMembers = new Set(countByRank.keys());
    const entries = mappings.map(mapping => ({
        mappingId: mapping.id,
        rsiRank: mapping.rsiRank,
        isActive: mapping.isActive,
        priority: mapping.priority,
        discordRoleId: mapping.discordRoleId ?? null,
        internalRoleId: mapping.internalRoleId ?? null,
        internalRoleName: mapping.internalRoleId
            ? (roleNameById.get(mapping.internalRoleId) ?? null)
            : null,
        permissions: mapping.getEnabledPermissions(),
        affectedMemberCount: countByRank.has(mapping.rsiRank)
            ? (countByRank.get(mapping.rsiRank) ?? 0)
            : null,
    }));
    const activeMappings = mappings.filter(m => m.isActive);
    const activeRankNames = new Set(activeMappings.map(m => m.rsiRank));
    const warnings = [];
    for (const [rank, count] of countByRank) {
        if (!activeRankNames.has(rank)) {
            warnings.push({
                type: 'unmapped_rank',
                rsiRank: rank,
                memberCount: count,
                message: `Rank "${rank}" has ${count} member(s) but no active mapping — they will not be synced.`,
            });
        }
    }
    for (const mapping of mappings) {
        if (!mapping.isActive && ranksWithMembers.has(mapping.rsiRank)) {
            warnings.push({
                type: 'inactive_mapping',
                rsiRank: mapping.rsiRank,
                message: `Mapping for rank "${mapping.rsiRank}" is inactive and will be skipped.`,
            });
        }
    }
    const ranksByDiscordRole = new Map();
    for (const mapping of activeMappings) {
        if (mapping.discordRoleId) {
            const ranks = ranksByDiscordRole.get(mapping.discordRoleId) ?? [];
            ranks.push(mapping.rsiRank);
            ranksByDiscordRole.set(mapping.discordRoleId, ranks);
        }
    }
    for (const [discordRoleId, ranks] of ranksByDiscordRole) {
        if (ranks.length > 1) {
            warnings.push({
                type: 'duplicate_discord_role',
                discordRoleId,
                message: `One Discord role is targeted by multiple ranks: ${ranks.join(', ')}.`,
            });
        }
    }
    for (const mapping of mappings) {
        if (mapping.internalRoleId && !roleNameById.has(mapping.internalRoleId)) {
            warnings.push({
                type: 'missing_internal_role',
                rsiRank: mapping.rsiRank,
                message: `Mapping for rank "${mapping.rsiRank}" references an internal role that no longer exists.`,
            });
        }
    }
    for (const mapping of activeMappings) {
        if (!ranksWithMembers.has(mapping.rsiRank)) {
            warnings.push({
                type: 'rank_no_members',
                rsiRank: mapping.rsiRank,
                message: `Active mapping for rank "${mapping.rsiRank}" matches no current members.`,
            });
        }
    }
    const mappedRanks = [...activeRankNames].filter(rank => ranksWithMembers.has(rank));
    const unmappedRanks = [...ranksWithMembers].filter(rank => !activeRankNames.has(rank));
    const knownAffectedMemberCount = mappedRanks.reduce((sum, rank) => sum + (countByRank.get(rank) ?? 0), 0);
    const unmappedMemberCount = unmappedRanks.reduce((sum, rank) => sum + (countByRank.get(rank) ?? 0), 0);
    const totalKnownMembers = [...countByRank.values()].reduce((sum, count) => sum + count, 0);
    return {
        entries,
        warnings,
        summary: {
            totalMappings: mappings.length,
            activeMappings: activeMappings.length,
            mappedRankCount: mappedRanks.length,
            unmappedRankCount: unmappedRanks.length,
            knownAffectedMemberCount,
            unmappedMemberCount,
            coveragePercent: totalKnownMembers > 0
                ? Math.round((knownAffectedMemberCount / totalKnownMembers) * 100)
                : null,
        },
    };
}
//# sourceMappingURL=rsiRoleSyncPreview.js.map