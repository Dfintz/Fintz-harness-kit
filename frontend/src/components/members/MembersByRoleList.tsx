/**
 * MembersByRoleList — Members grouped by their organization role
 *
 * Shows collapsible sections per role with member count badges,
 * role priority ordering (highest first), and member avatars.
 *
 * Wave 3.3 — Member Management Redesign
 */
import { useOrganizationMembers } from '@/hooks/queries/useOrganizationQueries';
import { useOrganizationRoles } from '@/hooks/queries/usePermissionQueries';
import type { OrganizationMemberV2 } from '@/services/organizationServiceV2';
import { sanitizeImageUrl } from '@/utils/sanitize';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Badge,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import React, { useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface MembersByRoleListProps {
  readonly organizationId: string;
}

interface RoleGroup {
  roleName: string;
  priority: number;
  members: OrganizationMemberV2[];
}

// ============================================================================
// Helpers
// ============================================================================

function getRoleColor(role: string): 'error' | 'warning' | 'primary' | 'default' {
  switch (role.toLowerCase()) {
    case 'owner':
    case 'founder':
      return 'error';
    case 'admin':
      return 'warning';
    case 'senior_officer':
    case 'fleet_commander':
    case 'officer':
      return 'primary';
    default:
      return 'default';
  }
}

function formatRoleName(role: string): string {
  return role.replaceAll('_', ' ').replaceAll(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// Component
// ============================================================================

export const MembersByRoleList: React.FC<MembersByRoleListProps> = ({ organizationId }) => {
  // Fetch all members (large page to get full roster)
  const { data: membersData, isLoading: membersLoading } = useOrganizationMembers(organizationId, {
    page: 1,
    limit: 500,
  });

  // Fetch roles for priority ordering
  const { data: roles = [] } = useOrganizationRoles(organizationId);

  // Build priority map from roles
  const rolePriorityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const role of roles) {
      map.set(role.name.toLowerCase(), role.priority);
    }
    return map;
  }, [roles]);

  // Group members by role, sorted by role priority (highest first)
  const roleGroups: RoleGroup[] = useMemo(() => {
    const members = membersData?.items ?? [];
    const groups = new Map<string, OrganizationMemberV2[]>();

    for (const member of members) {
      const role = member.role || 'member';
      const existing = groups.get(role);
      if (existing) {
        existing.push(member);
      } else {
        groups.set(role, [member]);
      }
    }

    const grouped = Array.from(groups.entries()).map(([roleName, roleMembers]) => ({
      roleName,
      priority: rolePriorityMap.get(roleName.toLowerCase()) ?? 0,
      members: [...roleMembers].sort((a, b) =>
        (a.displayName ?? a.username ?? '').localeCompare(b.displayName ?? b.username ?? '')
      ),
    }));

    return [...grouped].sort((a, b) => b.priority - a.priority);
  }, [membersData, rolePriorityMap]);

  if (membersLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (roleGroups.length === 0) {
    return <Alert severity="info">No members found.</Alert>;
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
        Members by Role
      </Typography>
      {roleGroups.map(group => (
        <Accordion key={group.roleName} defaultExpanded={group.priority >= 60} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip
                label={formatRoleName(group.roleName)}
                color={getRoleColor(group.roleName)}
                size="small"
                variant="outlined"
              />
              <Badge badgeContent={group.members.length} color="primary" max={999}>
                <Typography variant="body2" color="text.secondary" sx={{ pr: 1 }}>
                  {group.members.length === 1 ? 'member' : 'members'}
                </Typography>
              </Badge>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Stack spacing={0.5}>
              {group.members.map(member => (
                <Stack
                  key={member.userId}
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ py: 0.5 }}
                >
                  <Avatar
                    src={sanitizeImageUrl(member.avatar) || undefined}
                    alt={member.displayName ?? member.username}
                    sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
                  >
                    {(member.displayName ?? member.username ?? '?')[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {member.displayName ?? member.username ?? 'Unknown'}
                    </Typography>
                    {member.rsiHandle && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        RSI: {member.rsiHandle}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};
