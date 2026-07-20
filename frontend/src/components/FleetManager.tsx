/**
 * FleetManager
 *
 * Fleet-first management view. Users create fleets, then add ships to them
 * from the organization's available ship pool (org-owned + member-shared).
 *
 * Two-panel layout:
 * - Left/Top: FleetListPanel (fleet cards with create/delete)
 * - Right/Bottom: FleetDetailPanel (selected fleet) OR FleetAggregateOverview (no selection)
 *
 * Uses fleet API hooks — NOT individual ship CRUD hooks.
 */

import { FleetDetailPanel } from '@/components/fleet/FleetDetailPanel';
import { FleetListPanel } from '@/components/fleet/FleetListPanel';
import { FleetMoveDialog } from '@/components/fleet/FleetMoveDialog';
import { FleetTreeView } from '@/components/fleet/FleetTreeView';
import { PageHeader } from '@/components/PageHeader';
import { fleetKeys } from '@/hooks/queries/queryKeys';
import { useFleetHealth, useFleets, useFleetTree } from '@/hooks/queries/useFleetQueries';
import { useAuthStore } from '@/store/authStore';
import type { FleetV2 } from '@/types/apiV2';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FavoriteIcon from '@mui/icons-material/Favorite';
import Refresh from '@mui/icons-material/Refresh';
import ViewListIcon from '@mui/icons-material/ViewList';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { getFleetTypeMeta } from '@/constants/fleetTypes';
import { FleetBoxImportExport } from './FleetViewImportExport';

// ── Fleet summary card for aggregate view ────────────────────────

interface FleetSummaryProps {
  fleetId: string;
  name: string;
  type?: string;
  shipCount?: number;
  memberCount?: number;
  onClick: () => void;
}

const FleetSummaryCard: React.FC<Readonly<FleetSummaryProps>> = ({
  fleetId,
  name,
  type,
  shipCount,
  memberCount,
  onClick,
}) => {
  const theme = useTheme();
  const { data: health } = useFleetHealth(fleetId);
  const meta = getFleetTypeMeta(type, theme);

  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        transition: theme.transitions.create('all', { duration: 200 }),
        '&:hover': {
          borderColor: alpha(meta.color, 0.5),
          transform: 'translateY(-1px)',
          boxShadow: `0 4px 12px ${alpha(meta.color, 0.15)}`,
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ fontSize: '1.2rem', display: 'flex', color: meta.color }}>{meta.icon}</Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {name}
          </Typography>
        </Stack>
        <Chip
          label={meta.label}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.7rem',
            bgcolor: alpha(meta.color, 0.12),
            color: meta.color,
            border: `1px solid ${alpha(meta.color, 0.3)}`,
          }}
        />
      </Stack>

      {/* Ship / Crew stats */}
      <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>
            {shipCount ?? 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ships
          </Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>
            {memberCount ?? 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Crew
          </Typography>
        </Box>
      </Stack>

      {/* Health bar */}
      {health ? (
        <Box>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              Readiness
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <FavoriteIcon
                sx={{
                  fontSize: 12,
                  color:
                    health.status === 'green'
                      ? theme.palette.success.main
                      : health.status === 'yellow'
                        ? theme.palette.warning.main
                        : theme.palette.error.main,
                }}
              />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {health.healthScore}%
              </Typography>
            </Stack>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={health.healthScore}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.common.white, 0.06),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                bgcolor:
                  health.status === 'green'
                    ? 'success.main'
                    : health.status === 'yellow'
                      ? 'warning.main'
                      : 'error.main',
              },
            }}
          />
        </Box>
      ) : (
        <Typography variant="caption" color="text.disabled">
          Health data loading...
        </Typography>
      )}
    </Paper>
  );
};

// ── Main FleetManager ─────────────────────────────────────────────

export const FleetManager: React.FC = () => {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const user = useAuthStore(state => state.user);
  const orgId = user?.activeOrgId;
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [showFleetBoxDialog, setShowFleetBoxDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [moveFleetTarget, setMoveFleetTarget] = useState<FleetV2 | null>(null);
  const { data: treeData } = useFleetTree(viewMode === 'tree' ? orgId : undefined);

  const { data: fleetsData, isLoading: fleetsLoading } = useFleets(orgId);
  const fleets = fleetsData?.items ?? [];

  return (
    <Box width="100%" p={4}>
      <Stack direction="column" spacing={3} width="100%">
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <PageHeader
            title="Fleet Management"
            description="Create fleets, then add ships from your organization or members' hangars"
            helpTooltip="Create a fleet first, then assign ships to it from the org ship pool or members' shared ships. Use Import/Export to backup and restore fleet configurations."
            secondaryAction={{
              label: 'Refresh',
              icon: Refresh,
              onPress: () => void queryClient.invalidateQueries({ queryKey: fleetKeys.all }),
            }}
          />
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_e, v) => {
              if (v) setViewMode(v);
            }}
            size="small"
          >
            <ToggleButton value="list" aria-label="List view">
              <Tooltip title="List view">
                <ViewListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="tree" aria-label="Tree view">
              <Tooltip title="Tree view">
                <AccountTreeIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Button variant="outlined" onClick={() => setShowFleetBoxDialog(true)}>
            Import/Export
          </Button>
          <Dialog
            open={showFleetBoxDialog}
            onClose={() => setShowFleetBoxDialog(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>Fleet Import/Export</DialogTitle>
            <Divider />
            <DialogContent>
              <FleetBoxImportExport
                onImportComplete={() => {
                  setShowFleetBoxDialog(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </Stack>

        {/* Two-panel layout */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ minHeight: 400 }}>
          {/* Left panel: Fleet list or tree */}
          <Box sx={{ width: { xs: '100%', md: viewMode === 'tree' ? 360 : 320 }, flexShrink: 0 }}>
            {viewMode === 'tree' && orgId ? (
              <FleetTreeView
                organizationId={orgId}
                selectedFleetId={selectedFleetId ?? undefined}
                onFleetSelect={setSelectedFleetId}
                onMoveFleet={fleet => setMoveFleetTarget(fleet)}
              />
            ) : (
              <FleetListPanel
                selectedFleetId={selectedFleetId}
                onSelectFleet={setSelectedFleetId}
              />
            )}
          </Box>

          {/* Right panel: Fleet detail OR aggregate overview */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {selectedFleetId ? (
              <FleetDetailPanel
                fleetId={selectedFleetId}
                onFleetNotFound={() => setSelectedFleetId(null)}
              />
            ) : (
              /* ── Aggregate Overview ─────────────────────────── */
              <Box>
                {fleetsLoading && fleets.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : fleets.length === 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      minHeight: 200,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <Typography color="text.secondary">
                      Create your first fleet to get started
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      All Fleets Overview
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {fleets.length} fleet{fleets.length !== 1 ? 's' : ''} — select one to manage
                      ships, crew, and health
                    </Typography>

                    {/* Summary stats */}
                    <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                      <Paper
                        sx={{
                          p: 1.5,
                          flex: 1,
                          textAlign: 'center',
                          bgcolor: alpha(theme.palette.info.main, 0.04),
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                        }}
                      >
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {fleets.reduce((sum, f) => sum + (f.shipCount ?? 0), 0)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total Ships
                        </Typography>
                      </Paper>
                      <Paper
                        sx={{
                          p: 1.5,
                          flex: 1,
                          textAlign: 'center',
                          bgcolor: alpha(theme.palette.success.main, 0.04),
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                        }}
                      >
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {fleets.reduce((sum, f) => sum + (f.memberCount ?? 0), 0)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total Crew
                        </Typography>
                      </Paper>
                      <Paper
                        sx={{
                          p: 1.5,
                          flex: 1,
                          textAlign: 'center',
                          bgcolor: alpha(theme.palette.secondary.main, 0.04),
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                        }}
                      >
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                          {fleets.length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Fleets
                        </Typography>
                      </Paper>
                    </Stack>

                    {/* Per-fleet summary cards */}
                    <Stack spacing={1.5}>
                      {fleets.map(fleet => (
                        <FleetSummaryCard
                          key={fleet.id}
                          fleetId={fleet.id}
                          name={fleet.name}
                          type={fleet.type}
                          shipCount={fleet.shipCount}
                          memberCount={fleet.memberCount}
                          onClick={() => setSelectedFleetId(fleet.id)}
                        />
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Box>
            )}
          </Box>
        </Stack>

        {/* Fleet move dialog */}
        {orgId && (
          <FleetMoveDialog
            open={!!moveFleetTarget}
            onClose={() => setMoveFleetTarget(null)}
            fleet={moveFleetTarget}
            allFleets={treeData?.tree ?? []}
          />
        )}
      </Stack>
    </Box>
  );
};
