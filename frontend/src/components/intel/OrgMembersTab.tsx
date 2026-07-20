/**
 * OrgMembersTab
 *
 * Members list tab for the Intel Audit page (Wave 2.1 — F4 / F5).
 * Shows organization members using the shared MemberPanel with:
 *  - Clickable rows to open the MemberProfileDrawer (F4)
 *  - Flag-count badge chips per row (F5)
 *
 * Uses the shared MemberPanel component for consistent member list rendering.
 */
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import { Chip, Tooltip, Typography } from '@mui/material';
import React, { useMemo } from 'react';

import { MemberPanel } from '@/components/shared';
import { useOrganizationMembers } from '@/hooks/queries';
import type { OrganizationMemberV2 } from '@/services/organizationServiceV2';

/* ────────────────────────────────────────────────────────────────── */
/*  Flag Badge — per-member (inline, no extra API call initially)    */
/* ────────────────────────────────────────────────────────────────── */

interface FlagBadgeProps {
  /** Number of open / total flags — if 0 nothing renders */
  count: number;
  tooltip?: string;
}

const FlagBadge: React.FC<FlagBadgeProps> = ({ count, tooltip }) => {
  if (count <= 0) return null;

  const chip = (
    <Chip
      icon={<FlagOutlinedIcon fontSize="small" />}
      label={count}
      size="small"
      color={count >= 3 ? 'error' : 'warning'}
      variant="outlined"
      sx={{ ml: 1, cursor: 'pointer' }}
    />
  );

  return tooltip ? <Tooltip title={tooltip}>{chip}</Tooltip> : chip;
};

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                           */
/* ────────────────────────────────────────────────────────────────── */

function roleLabel(role: string | Record<string, unknown>): string {
  const name = typeof role === 'string' ? role : String(role?.name ?? 'member');
  return name.charAt(0).toUpperCase() + name.slice(1).replaceAll('_', ' ');
}

/* ────────────────────────────────────────────────────────────────── */
/*  Main Component                                                    */
/* ────────────────────────────────────────────────────────────────── */

interface OrgMembersTabProps {
  orgId: string;
  /** Flag stats map: userId → open flag count (fetched externally) */
  flagCountMap?: Map<string, number>;
  /** Called when user clicks a member row */
  onViewProfile: (userId: string) => void;
}

export const OrgMembersTab: React.FC<OrgMembersTabProps> = ({
  orgId,
  flagCountMap,
  onViewProfile,
}) => {
  /* Fetch org members */
  const { data, isLoading, isError, error } = useOrganizationMembers(orgId);

  const members: OrganizationMemberV2[] = useMemo(() => {
    if (!data) return [];
    return data.items ?? [];
  }, [data]);

  return (
    <MemberPanel<OrganizationMemberV2>
      members={members}
      getMemberId={m => m.userId}
      getMemberUserId={m => m.userId}
      getMemberName={m => m.displayName ?? m.username ?? m.userId.slice(0, 8)}
      getMemberUsername={m => m.username}
      getMemberAvatar={m => m.avatar}
      getMemberRole={m =>
        typeof m.role === 'string'
          ? m.role
          : String((m.role as unknown as Record<string, unknown>)?.name ?? 'member')
      }
      getMemberJoinedAt={m => m.joinedAt}
      renderRole={m => (
        <Chip
          label={roleLabel(m.role)}
          size="small"
          variant="outlined"
          sx={{ textTransform: 'capitalize' }}
        />
      )}
      renderExtra={m => {
        const flagCount = flagCountMap?.get(m.userId) ?? 0;
        return flagCount > 0 ? (
          <FlagBadge
            count={flagCount}
            tooltip={`${flagCount} open flag${flagCount === 1 ? '' : 's'}`}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        );
      }}
      extraColumnHeaders={['Flags']}
      onRowClick={m => onViewProfile(m.userId)}
      searchable
      loading={isLoading}
      error={isError ? (error?.message ?? 'Failed to load organization members.') : undefined}
      emptyContent={
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No members found for this organization.
        </Typography>
      }
    />
  );
};
