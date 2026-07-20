/**
 * Organization Chart Tab
 *
 * Displays the organization's internal hierarchy structure:
 * - Sub-organization tree (divisions, departments, teams) if they exist
 * - Member role tiers (owner, admin, officer, member, custom roles) fallback
 * - Team-based division grouping when teams exist
 *
 * Uses the same vertical hierarchy card pattern as the federation org chart.
 */
import {
  useOrganizationMembers,
  useOrganizationTree,
} from '@/hooks/queries/useOrganizationQueries';
import { useOrganizationRoles } from '@/hooks/queries/usePermissionQueries';
import { useTeamTree } from '@/hooks/queries/useTeamQueries';
import type { OrgTreeNode, OrganizationMemberV2 } from '@/services/organizationServiceV2';
import type { Role } from '@/services/permissionService';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AddIcon from '@mui/icons-material/Add';
import GroupsIcon from '@mui/icons-material/Groups';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { TeamTreeNode } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useMemo, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface OrgChartTabProps {
  organizationId: string;
}

// ============================================================================
// Helpers
// ============================================================================

const ORG_TYPE_META: Record<string, { label: string; description: string; order: number }> = {
  root: { label: 'Headquarters', description: 'Root organization', order: 0 },
  division: { label: 'Division', description: 'Major organizational division', order: 1 },
  department: { label: 'Department', description: 'Functional department', order: 2 },
  team: { label: 'Team', description: 'Operational team', order: 3 },
  project: { label: 'Project', description: 'Project group', order: 4 },
};

const ROLE_TIERS: Record<string, { order: number; label: string; description: string }> = {
  owner: { order: 0, label: 'Owner', description: 'Organization creator and owner' },
  founder: { order: 0, label: 'Founder', description: 'Organization founder' },
  admin: { order: 1, label: 'Admins', description: 'Full administrative access' },
  officer: { order: 2, label: 'Officers', description: 'Operational leadership' },
  member: { order: 3, label: 'Members', description: 'Standard members' },
};

/** Deterministic color for custom roles based on name hash */
const CUSTOM_ROLE_PALETTE = ['info', 'secondary', 'success', 'warning', 'primary'] as const;

const getCustomRoleColor = (roleName: string, theme: Theme): string => {
  let hash = 0;
  for (let i = 0; i < roleName.length; i++) {
    hash = (roleName.codePointAt(i) ?? 0) + ((hash << 5) - hash);
  }
  const palette = CUSTOM_ROLE_PALETTE[Math.abs(hash) % CUSTOM_ROLE_PALETTE.length];
  return theme.palette[palette].main;
};

const TEAM_TYPE_COLORS: Record<string, (theme: Theme) => string> = {
  division: t => t.palette.primary.main,
  squadron: t => t.palette.info.main,
  crew: t => t.palette.success.main,
  platoon: t => t.palette.warning.main,
  custom: t => t.palette.secondary.main,
};

const getOrgTypeColor = (type: string, theme: Theme): string => {
  switch (type) {
    case 'root':
      return theme.palette.warning.main;
    case 'division':
      return theme.palette.primary.main;
    case 'department':
      return theme.palette.secondary.main;
    case 'team':
      return theme.palette.success.main;
    case 'project':
      return theme.palette.info.main;
    default:
      return theme.palette.grey[600];
  }
};

const getRoleTierColor = (role: string, theme: Theme): string => {
  switch (role) {
    case 'owner':
    case 'founder':
      return theme.palette.warning.main;
    case 'admin':
      return theme.palette.primary.main;
    case 'officer':
      return theme.palette.secondary.main;
    case 'member':
      return theme.palette.success.main;
    default:
      return getCustomRoleColor(role, theme);
  }
};

// ============================================================================
// Sub-Components
// ============================================================================

// ---------------------------------------------------------------------------
// Generic hierarchy tree with parallel branch support
// ---------------------------------------------------------------------------

/** Minimal shape a tree node must satisfy to be rendered by the generic tree. */
interface HierarchyItem {
  id: string;
  children?: HierarchyItem[];
}

/** Renders the card content for a single node (injected via render-prop). */
type RenderNodeCard<T extends HierarchyItem> = (node: T, depth: number) => React.ReactNode;

/** Computes connector line position for the horizontal rail segment. */
const getHorizontalSegmentPosition = (
  index: number,
  total: number
): { left: string | number; right: string | number } => {
  if (index === 0) return { left: '50%', right: 0 };
  if (index === total - 1) return { left: 0, right: '50%' };
  return { left: 0, right: 0 };
};

/**
 * Renders sibling nodes as parallel horizontal branches with connectors.
 * Single-child lists stay compact with a plain vertical connector.
 */
function BranchChildren<T extends HierarchyItem>({
  items,
  depth,
  renderCard,
}: Readonly<{
  items: T[];
  depth: number;
  renderCard: RenderNodeCard<T>;
}>): React.ReactElement {
  const theme = useTheme();
  const connectorColor = alpha(theme.palette.primary.main, 0.15);

  if (items.length === 1) {
    return (
      <>
        <Box sx={{ width: 2, height: 20, bgcolor: connectorColor }} />
        <HierarchyNode node={items[0]} depth={depth} renderCard={renderCard} />
      </>
    );
  }

  return (
    <>
      {/* Vertical line from parent down to horizontal rail */}
      <Box sx={{ width: 2, height: 20, bgcolor: connectorColor }} />

      {/* Horizontal rail + children */}
      <Box sx={{ display: 'flex' }}>
        {items.map((child, i) => (
          <Box
            key={child.id}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              px: 0.5,
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                height: '2px',
                backgroundColor: connectorColor,
                ...getHorizontalSegmentPosition(i, items.length),
              },
            }}
          >
            <Box sx={{ width: 2, height: 20, bgcolor: connectorColor }} />
            <HierarchyNode node={child} depth={depth} renderCard={renderCard} />
          </Box>
        ))}
      </Box>
    </>
  );
}

/**
 * Renders a single hierarchy node (card + recursive children with parallel branches).
 */
function HierarchyNode<T extends HierarchyItem>({
  node,
  depth,
  renderCard,
}: Readonly<{
  node: T;
  depth: number;
  renderCard: RenderNodeCard<T>;
}>): React.ReactElement {
  const nodeChildren = (node.children ?? []) as T[];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {renderCard(node, depth)}
      {nodeChildren.length > 0 && (
        <BranchChildren items={nodeChildren} depth={depth + 1} renderCard={renderCard} />
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Org-tree card (sub-organization hierarchy)
// ---------------------------------------------------------------------------

const renderOrgCard: RenderNodeCard<OrgTreeNode> = (node, depth) => {
  /* eslint-disable react-hooks/rules-of-hooks -- render-prop always called inside React tree */
  const theme = useTheme();
  /* eslint-enable react-hooks/rules-of-hooks */
  const typeKey = (node.type ?? 'root').toLowerCase();
  const color = getOrgTypeColor(typeKey, theme);
  const meta = ORG_TYPE_META[typeKey] ?? { label: typeKey, description: '', order: depth };

  return (
    <Paper
      sx={{
        background: alpha(theme.palette.background.paper, 0.6),
        border: `1px solid ${alpha(color, 0.2)}`,
        borderRadius: 2,
        width: 'max-content',
        minWidth: 220,
        maxWidth: 400,
        py: 2,
        px: 2.5,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={meta.label}
            size="small"
            sx={{
              bgcolor: alpha(color, 0.12),
              color,
              fontWeight: 700,
              fontSize: '0.75rem',
              border: `1px solid ${alpha(color, 0.3)}`,
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {node.name}
          </Typography>
        </Stack>
        {(node.totalMembers ?? 0) > 0 && (
          <Chip
            icon={<GroupsIcon sx={{ fontSize: 14 }} />}
            label={node.totalMembers}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
        )}
      </Stack>
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// Team-tree card (division / team hierarchy with member chips)
// ---------------------------------------------------------------------------

/**
 * Builds a render-prop for team division cards that captures the member list.
 */
const createTeamCardRenderer = (members: OrganizationMemberV2[]): RenderNodeCard<TeamTreeNode> => {
  const renderTeamCard: RenderNodeCard<TeamTreeNode> = (node, _depth) => {
    /* eslint-disable react-hooks/rules-of-hooks */
    const theme = useTheme();
    /* eslint-enable react-hooks/rules-of-hooks */
    const colorFn = TEAM_TYPE_COLORS[node.type] ?? TEAM_TYPE_COLORS.custom;
    const color = colorFn(theme);

    const nodeName = node.name.toLowerCase();
    const teamMembers = members.filter(m =>
      m.teams?.some(t => t.teamName.toLowerCase() === nodeName)
    );

    return (
      <Paper
        sx={{
          background: alpha(theme.palette.background.paper, 0.5),
          border: `1px solid ${alpha(color, 0.2)}`,
          borderRadius: 2,
          width: 'max-content',
          minWidth: 160,
          maxWidth: 360,
          py: 1.5,
          px: 1.5,
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: teamMembers.length > 0 ? 1 : 0 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={node.type.charAt(0).toUpperCase() + node.type.slice(1)}
              size="small"
              sx={{
                bgcolor: alpha(color, 0.12),
                color,
                fontWeight: 700,
                fontSize: '0.7rem',
                border: `1px solid ${alpha(color, 0.3)}`,
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {node.name}
            </Typography>
          </Stack>
          {node.memberCount > 0 && (
            <Chip
              icon={<GroupsIcon sx={{ fontSize: 14 }} />}
              label={node.memberCount}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </Stack>
        {teamMembers.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {teamMembers.map(m => {
              const teamInfo = m.teams?.find(t => t.teamName.toLowerCase() === nodeName);
              return (
                <Chip
                  key={m.userId}
                  label={
                    teamInfo?.teamRole && teamInfo.teamRole !== 'member'
                      ? `${m.displayName || m.username || 'Unknown'} (${teamInfo.teamRole})`
                      : m.displayName || m.username || 'Unknown'
                  }
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.common.white, 0.04),
                    color: 'text.primary',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                />
              );
            })}
          </Stack>
        )}
      </Paper>
    );
  };
  return renderTeamCard;
};

/**
 * Renders a single tier card in the hierarchy
 */
const TierCard: React.FC<
  Readonly<{
    tier: {
      role: string;
      label: string;
      description: string;
      members: OrganizationMemberV2[];
      isCustom?: boolean;
    };
    index: number;
  }>
> = ({ tier, index }) => {
  const tierTheme = useTheme();
  const color = getRoleTierColor(tier.role, tierTheme);

  return (
    <React.Fragment>
      {index > 0 && (
        <Box
          sx={{
            width: 2,
            height: 24,
            bgcolor: alpha(tierTheme.palette.primary.main, 0.2),
          }}
        />
      )}
      <Paper
        sx={{
          background: alpha(tierTheme.palette.background.paper, 0.6),
          border: `1px solid ${alpha(color, 0.2)}`,
          borderRadius: 2,
          width: '100%',
          maxWidth: Math.max(300, 600 - index * 50),
          py: 2,
          px: 2.5,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={tier.label}
              size="small"
              sx={{
                bgcolor: alpha(color, 0.12),
                color,
                fontWeight: 700,
                fontSize: '0.75rem',
                border: `1px solid ${alpha(color, 0.3)}`,
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {tier.description}
            </Typography>
            {tier.isCustom && (
              <Chip
                label="Custom"
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 18 }}
              />
            )}
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {tier.members.map(m => (
            <Chip
              key={m.userId}
              label={m.displayName || m.username || 'Unknown'}
              size="small"
              sx={{
                bgcolor: alpha(tierTheme.palette.common.white, 0.04),
                color: 'text.primary',
                fontWeight: 600,
                fontSize: '0.75rem',
                border: `1px solid ${tierTheme.palette.divider}`,
              }}
            />
          ))}
        </Stack>
      </Paper>
    </React.Fragment>
  );
};

/**
 * Member role tier visualization with custom role support and team divisions
 */
const MemberRoleTiers: React.FC<
  Readonly<{
    organizationId: string;
  }>
> = ({ organizationId }) => {
  const { data: membersData, isLoading: membersLoading } = useOrganizationMembers(organizationId, {
    limit: 200,
    page: 1,
  });
  const { data: rolesData, isLoading: rolesLoading } = useOrganizationRoles(organizationId);
  const { data: teamTreeData, isLoading: teamsLoading } = useTeamTree(organizationId);
  const roleZoom = useZoom();
  const teamZoom = useZoom();

  const members = useMemo(() => membersData?.items ?? [], [membersData?.items]);
  const roles: Role[] = rolesData ?? [];
  const teamTree = teamTreeData?.tree ?? [];
  const teamCardRenderer = useMemo(() => createTeamCardRenderer(members), [members]);

  const isLoading = membersLoading || rolesLoading;
  if (isLoading) return <CircularProgress size={24} />;

  if (members.length === 0) {
    return <Alert severity="info">No members found in this organization.</Alert>;
  }

  // Build a lookup of custom roles by name (lowercased)
  const customRolesByName = new Map<string, Role>();
  for (const role of roles) {
    if (!role.isSystemRole) {
      customRolesByName.set(role.name.toLowerCase(), role);
    }
  }

  // Build tiers: built-in roles first, then custom roles
  const builtInTiers = Object.entries(ROLE_TIERS)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([role, info]) => ({
      ...info,
      role,
      isCustom: false,
      members: members.filter((m: OrganizationMemberV2) => m.role?.toLowerCase() === role),
    }))
    .filter(t => t.members.length > 0);

  // Custom role tiers — each custom role gets its own tier
  const knownRoles = new Set(Object.keys(ROLE_TIERS));
  const customMembers = members.filter(
    (m: OrganizationMemberV2) => !knownRoles.has(m.role?.toLowerCase() ?? '')
  );

  // Group custom-role members by their role name
  const customRoleGroups = new Map<string, OrganizationMemberV2[]>();
  for (const m of customMembers) {
    const roleLower = m.role?.toLowerCase() ?? 'unknown';
    const existing = customRoleGroups.get(roleLower) ?? [];
    existing.push(m);
    customRoleGroups.set(roleLower, existing);
  }

  const customTiers = Array.from(customRoleGroups.entries())
    .map(([roleLower, roleMembers]) => {
      const roleDef = customRolesByName.get(roleLower);
      return {
        role: roleLower,
        label: roleDef?.name ?? roleMembers[0]?.role ?? roleLower,
        description: roleDef?.description ?? 'Custom role',
        order: roleDef ? 50 + (100 - (roleDef.priority ?? 0)) : 90,
        isCustom: true,
        members: roleMembers,
      };
    })
    .sort((a, b) => a.order - b.order);

  const allTiers = [...builtInTiers, ...customTiers];

  const hasTeams = teamTree.length > 0 && !teamsLoading;

  return (
    <Stack spacing={3}>
      {/* Role-based hierarchy */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ZoomControls
          scale={roleZoom.scale}
          onZoomIn={roleZoom.zoomIn}
          onZoomOut={roleZoom.zoomOut}
          onReset={roleZoom.reset}
        />
      </Box>
      <Box ref={roleZoom.containerRef} sx={{ overflow: 'auto', pb: 2 }}>
        <Box
          sx={{
            transform: `scale(${roleZoom.scale})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease',
          }}
        >
          <Stack spacing={0} alignItems="center">
            {allTiers.map((tier, i) => (
              <TierCard key={tier.role} tier={tier} index={i} />
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Team / Division grouping */}
      {hasTeams && (
        <>
          <Divider sx={{ my: 1 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <GroupsIcon sx={{ fontSize: 20, color: 'info.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Divisions & Teams
              </Typography>
            </Stack>
            <ZoomControls
              scale={teamZoom.scale}
              onZoomIn={teamZoom.zoomIn}
              onZoomOut={teamZoom.zoomOut}
              onReset={teamZoom.reset}
            />
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Members grouped by team assignments
          </Typography>
          <Box ref={teamZoom.containerRef} sx={{ overflowX: 'auto', pb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 'fit-content',
                transform: `scale(${teamZoom.scale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease',
              }}
            >
              <BranchChildren items={teamTree} depth={0} renderCard={teamCardRenderer} />
            </Box>
          </Box>
        </>
      )}
    </Stack>
  );
};

// ============================================================================
// Main Component
// ============================================================================

// ============================================================================
// Zoom Controls
// ============================================================================

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.15;

const ZoomControls: React.FC<
  Readonly<{
    scale: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
  }>
> = ({ scale, onZoomIn, onZoomOut, onReset }) => {
  const theme = useTheme();
  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={{
        bgcolor: alpha(theme.palette.background.paper, 0.8),
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        px: 0.5,
        py: 0.25,
      }}
    >
      <Tooltip title="Zoom out">
        <span>
          <IconButton size="small" onClick={onZoomOut} disabled={scale <= MIN_ZOOM}>
            <RemoveIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Reset zoom">
        <IconButton size="small" onClick={onReset} sx={{ fontSize: '0.75rem', minWidth: 40 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {Math.round(scale * 100)}%
          </Typography>
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom in">
        <span>
          <IconButton size="small" onClick={onZoomIn} disabled={scale >= MAX_ZOOM}>
            <AddIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
};

function useZoom() {
  const [scale, setScale] = useState(1);
  const cleanupRef = useRef<(() => void) | null>(null);

  const zoomIn = useCallback(() => {
    setScale(s => Math.min(MAX_ZOOM, +(s + ZOOM_STEP).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(s => Math.max(MIN_ZOOM, +(s - ZOOM_STEP).toFixed(2)));
  }, []);

  const reset = useCallback(() => setScale(1), []);

  // Callback ref: attaches a non-passive wheel listener whenever the element changes
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    // Clean up previous listener
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale(s => {
          const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
          return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(s + delta).toFixed(2)));
        });
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    cleanupRef.current = () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return { scale, zoomIn, zoomOut, reset, containerRef };
}

export const OrgChartTab: React.FC<Readonly<OrgChartTabProps>> = ({ organizationId }) => {
  const theme = useTheme();
  const {
    data: tree,
    isLoading: treeLoading,
    error: treeError,
  } = useOrganizationTree(organizationId);
  const { data: rolesData } = useOrganizationRoles(organizationId);
  const zoom = useZoom();

  const hasSubOrgs = tree?.children && tree.children.length > 0;

  // Collect custom role names for the legend
  const customRoleNames = useMemo(() => {
    if (!rolesData) return [];
    return rolesData
      .filter((r: Role) => !r.isSystemRole)
      .sort((a: Role, b: Role) => (b.priority ?? 0) - (a.priority ?? 0))
      .map((r: Role) => r.name);
  }, [rolesData]);

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} alignItems="center">
        <AccountTreeRoundedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Organization Chart
        </Typography>
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {hasSubOrgs
            ? 'Organization hierarchy and sub-organization structure'
            : 'Organization structure by member roles'}
        </Typography>
        {hasSubOrgs && (
          <ZoomControls
            scale={zoom.scale}
            onZoomIn={zoom.zoomIn}
            onZoomOut={zoom.zoomOut}
            onReset={zoom.reset}
          />
        )}
      </Stack>

      {treeLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {treeError && !treeLoading && <MemberRoleTiers organizationId={organizationId} />}

      {!treeLoading && !treeError && hasSubOrgs && (
        <Box ref={zoom.containerRef} sx={{ overflow: 'auto', pb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: 'fit-content',
              transform: `scale(${zoom.scale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
            }}
          >
            <HierarchyNode node={tree} depth={0} renderCard={renderOrgCard} />
          </Box>
        </Box>
      )}

      {!treeLoading && !treeError && !hasSubOrgs && (
        <MemberRoleTiers organizationId={organizationId} />
      )}

      {/* Legend */}
      <Paper
        sx={{
          background: alpha(theme.palette.background.paper, 0.4),
          border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
          borderRadius: 2,
          p: 2,
          mt: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
          {hasSubOrgs ? 'HIERARCHY TYPES' : 'ROLE TIERS'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {hasSubOrgs ? (
            Object.entries(ORG_TYPE_META).map(([key, meta]) => (
              <Chip
                key={key}
                label={meta.label}
                size="small"
                sx={{
                  bgcolor: alpha(getOrgTypeColor(key, theme), 0.12),
                  color: getOrgTypeColor(key, theme),
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  border: `1px solid ${alpha(getOrgTypeColor(key, theme), 0.2)}`,
                }}
              />
            ))
          ) : (
            <>
              {Object.entries(ROLE_TIERS).map(([key, info]) => (
                <Chip
                  key={key}
                  label={info.label}
                  size="small"
                  sx={{
                    bgcolor: alpha(getRoleTierColor(key, theme), 0.12),
                    color: getRoleTierColor(key, theme),
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    border: `1px solid ${alpha(getRoleTierColor(key, theme), 0.2)}`,
                  }}
                />
              ))}
              {customRoleNames.map(name => {
                const color = getRoleTierColor(name.toLowerCase(), theme);
                return (
                  <Chip
                    key={name}
                    label={name}
                    size="small"
                    sx={{
                      bgcolor: alpha(color, 0.12),
                      color,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      border: `1px solid ${alpha(color, 0.2)}`,
                    }}
                  />
                );
              })}
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
};
