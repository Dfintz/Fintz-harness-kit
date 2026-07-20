/**
 * FleetAuditLogPanel
 *
 * Displays a chronological audit log of all changes to a fleet:
 * fleet lifecycle, ship assignments, team/crew changes, hierarchy moves,
 * and health gate events.
 */

import { useFleetAuditLog } from '@/hooks/queries/useFleetQueries';
import type { FleetAuditEntry } from '@/services/fleetServiceV2';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat';
import EditIcon from '@mui/icons-material/Edit';
import GroupsIcon from '@mui/icons-material/Groups';
import HistoryIcon from '@mui/icons-material/History';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import PersonIcon from '@mui/icons-material/Person';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SecurityIcon from '@mui/icons-material/Security';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

// ============================================================================
// Helpers
// ============================================================================

/** Map audit actions to display metadata */
function getActionMeta(action: string): {
  label: string;
  icon: React.ReactElement;
  color: string;
} {
  const map: Record<string, { label: string; icon: React.ReactElement; color: string }> = {
    FLEET_CREATED: { label: 'Fleet Created', icon: <AddCircleIcon />, color: 'success' },
    FLEET_UPDATED: { label: 'Fleet Updated', icon: <EditIcon />, color: 'primary' },
    FLEET_DELETED: { label: 'Fleet Deleted', icon: <DeleteIcon />, color: 'error' },
    FLEET_ARCHIVED: { label: 'Fleet Archived', icon: <DeleteIcon />, color: 'warning' },
    FLEET_RESTORED: { label: 'Fleet Restored', icon: <AddCircleIcon />, color: 'success' },

    SHIP_ADDED_TO_FLEET: {
      label: 'Ship Added',
      icon: <DirectionsBoatIcon />,
      color: 'success',
    },
    SHIP_REMOVED_FROM_FLEET: {
      label: 'Ship Removed',
      icon: <DirectionsBoatIcon />,
      color: 'error',
    },
    SHIPS_BULK_ADDED: {
      label: 'Ships Bulk Added',
      icon: <DirectionsBoatIcon />,
      color: 'success',
    },

    FLEET_NESTED: { label: 'Fleet Nested', icon: <MoveDownIcon />, color: 'info' },
    FLEET_UNNESTED: { label: 'Fleet Unnested', icon: <MoveDownIcon />, color: 'info' },
    FLEET_REORDERED: { label: 'Fleet Reordered', icon: <MoveDownIcon />, color: 'info' },

    FLEET_TEAM_CREATED: { label: 'Team Created', icon: <GroupsIcon />, color: 'success' },
    FLEET_TEAM_CAPACITY_UPDATED: {
      label: 'Team Capacity Updated',
      icon: <GroupsIcon />,
      color: 'primary',
    },
    FLEET_TEAM_REPARENTED: { label: 'Team Reparented', icon: <GroupsIcon />, color: 'info' },
    FLEET_TEAM_DELETED: { label: 'Team Deleted', icon: <GroupsIcon />, color: 'error' },

    CREW_MEMBER_ASSIGNED: {
      label: 'Member Joined',
      icon: <LoginIcon />,
      color: 'success',
    },
    CREW_MEMBER_UNASSIGNED: {
      label: 'Member Left',
      icon: <LogoutIcon />,
      color: 'warning',
    },
    CREW_MEMBER_UNAVAILABLE: {
      label: 'Member Unavailable',
      icon: <PersonOffIcon />,
      color: 'error',
    },
    CREW_POSITION_SELECTED: {
      label: 'Position Selected',
      icon: <PersonIcon />,
      color: 'success',
    },
    CREW_POSITION_VACATED: {
      label: 'Position Vacated',
      icon: <SwapHorizIcon />,
      color: 'warning',
    },

    FLEET_GATE_PASSED: { label: 'Gate Passed', icon: <SecurityIcon />, color: 'success' },
    FLEET_GATE_FAILED: { label: 'Gate Failed', icon: <SecurityIcon />, color: 'error' },
  };

  return (
    map[action] ?? {
      label: action.replaceAll('_', ' '),
      icon: <HistoryIcon />,
      color: 'primary',
    }
  );
}

/** Build a human-readable summary from the event details */
function buildDescription(action: string, details: Record<string, unknown>): string | null {
  const builders: Record<string, () => string | null> = {
    FLEET_CREATED: () => (details.name ? `Created fleet "${details.name}"` : null),
    FLEET_UPDATED: () => {
      const fields = Object.keys(details).filter(k => k !== 'fleetId');
      return fields.length > 0 ? `Updated: ${fields.join(', ')}` : null;
    },
    FLEET_DELETED: () => (details.name ? `Deleted fleet "${details.name}"` : null),
    SHIP_ADDED_TO_FLEET: () => (details.shipName ? `Added ship "${details.shipName}"` : null),
    SHIP_REMOVED_FROM_FLEET: () =>
      details.shipName ? `Removed ship "${details.shipName}"` : null,
    SHIPS_BULK_ADDED: () => {
      const count = details.count ?? details.shipCount;
      return count ? `Added ${count} ships` : null;
    },
    FLEET_NESTED: () =>
      details.parentFleetName ? `Nested under "${details.parentFleetName}"` : null,
    FLEET_UNNESTED: () =>
      details.previousParentFleetName ? `Unnested from "${details.previousParentFleetName}"` : null,
    FLEET_TEAM_CREATED: () => (details.teamName ? `Created team "${details.teamName}"` : null),
    FLEET_TEAM_CAPACITY_UPDATED: () =>
      details.previousCapacity === undefined
        ? null
        : `Capacity ${details.previousCapacity} → ${details.newCapacity}`,
    FLEET_TEAM_REPARENTED: () =>
      details.newParentFleetName ? `Team moved under "${details.newParentFleetName}"` : null,
    FLEET_TEAM_DELETED: () => (details.teamName ? `Deleted team "${details.teamName}"` : null),
    CREW_MEMBER_ASSIGNED: () => {
      const name = details.memberName ?? details.username;
      const ship = details.shipName;
      if (name && ship) return `${name} assigned to "${ship}"`;
      if (name) return `${name} joined the crew`;
      return null;
    },
    CREW_MEMBER_UNASSIGNED: () => {
      const name = details.memberName ?? details.username;
      const ship = details.shipName;
      if (name && ship) return `${name} removed from "${ship}"`;
      if (name) return `${name} left the crew`;
      return null;
    },
    CREW_MEMBER_UNAVAILABLE: () =>
      details.memberName
        ? `${details.memberName}: ${details.previousStatus} → ${details.newStatus}`
        : null,
    CREW_POSITION_SELECTED: () =>
      details.shipName ? `Selected "${details.role}" on "${details.shipName}"` : null,
    CREW_POSITION_VACATED: () =>
      details.previousRole ? `Vacated "${details.previousRole}" position` : null,
    FLEET_GATE_PASSED: () =>
      details.gate ? `${String(details.gate)} gate now passing` : 'Crew gate passed',
    FLEET_GATE_FAILED: () =>
      details.gate ? `${String(details.gate)} gate failing` : 'Crew gate failed',
  };

  return builders[action]?.() ?? null;
}

/** Format ISO timestamp to relative time */
function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================================================
// Sub-components
// ============================================================================

const AuditEntryRow: React.FC<Readonly<{ entry: FleetAuditEntry }>> = ({ entry }) => {
  const theme = useTheme();
  const meta = getActionMeta(entry.action);
  const description = buildDescription(entry.action, entry.details);
  const paletteKey = meta.color as 'success' | 'error' | 'warning' | 'info' | 'primary';

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{
        py: 1,
        px: 1.5,
        borderRadius: 1,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) },
      }}
    >
      {/* Icon */}
      <Avatar
        sx={{
          width: 28,
          height: 28,
          bgcolor: alpha(theme.palette[paletteKey].main, 0.12),
          color: theme.palette[paletteKey].main,
        }}
      >
        {React.cloneElement(meta.icon, { sx: { fontSize: 15 } })}
      </Avatar>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
            {meta.label}
          </Typography>
          {entry.performedByName && (
            <Typography variant="caption" color="text.secondary">
              by {entry.performedByName}
            </Typography>
          )}
        </Stack>
        {description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>

      {/* Timestamp */}
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ whiteSpace: 'nowrap', fontSize: '0.68rem', pt: 0.25 }}
      >
        {formatTimestamp(entry.timestamp)}
      </Typography>
    </Stack>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface FleetAuditLogPanelProps {
  fleetId: string;
}

export const FleetAuditLogPanel: React.FC<Readonly<FleetAuditLogPanelProps>> = ({ fleetId }) => {
  const theme = useTheme();
  const { data: entries, isLoading, error } = useFleetAuditLog(fleetId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load audit log</Alert>;
  }

  if (!entries || entries.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <HistoryIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
        <Typography color="text.secondary">No audit events recorded yet</Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
          Changes to this fleet will appear here
        </Typography>
      </Box>
    );
  }

  return (
    <Paper
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <HistoryIcon sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
          Fleet Activity Log
        </Typography>
        <Chip
          size="small"
          label={`${entries.length} events`}
          sx={{
            height: 20,
            fontSize: '0.7rem',
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
          }}
        />
      </Stack>

      {/* Event list */}
      <Stack
        divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}
        sx={{ maxHeight: 500, overflowY: 'auto' }}
      >
        {entries.map((entry: FleetAuditEntry, index: number) => (
          <AuditEntryRow key={`${entry.timestamp}-${index}`} entry={entry} />
        ))}
      </Stack>
    </Paper>
  );
};
