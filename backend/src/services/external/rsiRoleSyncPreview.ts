import type { RsiRoleMapping } from '../../models/RsiRoleMapping';

/** A single mapping projected into the dry-run sync plan. */
export interface RoleSyncPreviewEntry {
  mappingId: string;
  rsiRank: string;
  isActive: boolean;
  /** Display/sort order only — NOT used for conflict resolution (rsiRank match is unique). */
  priority: number;
  discordRoleId: string | null;
  internalRoleId: string | null;
  internalRoleName: string | null;
  permissions: string[];
  /** Members holding this rank; `null` = unknown (rank absent from the star-based discovery data). */
  affectedMemberCount: number | null;
}

export type RoleSyncPreviewWarningType =
  | 'unmapped_rank'
  | 'inactive_mapping'
  | 'duplicate_discord_role'
  | 'missing_internal_role'
  | 'rank_no_members';

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
    /** Over members with a known rank count; `null` when no known members exist. */
    coveragePercent: number | null;
  };
}

/** Subset of the discovered-ranks payload the preview consumes. */
export interface DiscoveredRankCounts {
  rankMap: Array<{ stars: number; name: string; count: number }>;
}

/**
 * Pure projection of the configured role mappings + discovered rank counts into a
 * read-only dry-run plan. Side-effect free and fully unit-testable.
 *
 * Resolution mirrors the real apply path (RsiUserLinkService): a member's role is
 * selected by an exact `rsiRank` match on an ACTIVE mapping (unique per org);
 * `priority` only affects display order, never which mapping wins.
 */
export function buildRoleSyncPreview(
  mappings: RsiRoleMapping[],
  discovered: DiscoveredRankCounts,
  roleNameById: Map<string, string>
): RoleSyncPreview {
  // Member counts by rank NAME. Each crawled member has exactly one rank, so
  // summing the (stars, name) groups by name yields distinct members with no
  // double-counting.
  const countByRank = new Map<string, number>();
  for (const row of discovered.rankMap) {
    countByRank.set(row.name, (countByRank.get(row.name) ?? 0) + row.count);
  }
  const ranksWithMembers = new Set(countByRank.keys());

  const entries: RoleSyncPreviewEntry[] = mappings.map(mapping => ({
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
  const warnings: RoleSyncPreviewWarning[] = [];

  // Discovered ranks with members but no active mapping.
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

  // Inactive mappings for a rank members currently hold.
  for (const mapping of mappings) {
    if (!mapping.isActive && ranksWithMembers.has(mapping.rsiRank)) {
      warnings.push({
        type: 'inactive_mapping',
        rsiRank: mapping.rsiRank,
        message: `Mapping for rank "${mapping.rsiRank}" is inactive and will be skipped.`,
      });
    }
  }

  // Same Discord role targeted by multiple active mappings.
  const ranksByDiscordRole = new Map<string, string[]>();
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

  // Mappings referencing a deleted internal role, and active mappings matching no members.
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
  const knownAffectedMemberCount = mappedRanks.reduce(
    (sum, rank) => sum + (countByRank.get(rank) ?? 0),
    0
  );
  const unmappedMemberCount = unmappedRanks.reduce(
    (sum, rank) => sum + (countByRank.get(rank) ?? 0),
    0
  );
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
      coveragePercent:
        totalKnownMembers > 0
          ? Math.round((knownAffectedMemberCount / totalKnownMembers) * 100)
          : null,
    },
  };
}

