/**
 * SquadronList — Sprint 3-D
 *
 * Displays fleets as squadrons with member counts, role stats, and
 * member management. Uses existing fleet hooks for the fleet list and
 * squadron hooks for member-level data.
 */

import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { DataTable, type DataTableColumn } from '@/components/shared';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useFleets } from '@/hooks/queries/useFleetQueries';
import {
  useAddSquadronMember,
  useRemoveSquadronMember,
  useSquadronMembers,
  useSquadronStats,
  useUpdateSquadronRole,
} from '@/hooks/queries/useSquadronQueries';
import {
  useAddTeamMember,
  useRemoveTeamMember,
  useTeamMembers,
  useUpdateTeamMember,
} from '@/hooks/queries/useTeamQueries';
import { useAuthStore } from '@/store/authStore';
import type { FleetV2, SquadronMember } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import type { TeamMember, TeamMemberRole } from '@sc-fleet-manager/shared-types';
import React, { useState } from 'react';

// ============================================================================
// Squadron Overview — list of fleets-as-squadrons
// ============================================================================

const SquadronOverview: React.FC<{
  fleets: FleetV2[];
  onSelect: (fleet: FleetV2) => void;
}> = ({ fleets, onSelect }) => {
  const theme = useTheme();

  const columns: DataTableColumn<FleetV2>[] = [
    {
      key: 'name',
      header: 'Squadron',
      sortable: true,
      render: row => (
        <Typography variant="body2" fontWeight="medium">
          {row.name}
        </Typography>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: row => (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
          {row.description || '—'}
        </Typography>
      ),
    },
    {
      key: 'memberCount',
      header: 'Members',
      sortable: true,
      align: 'right',
      render: row => (
        <Chip icon={<GroupIcon />} label={row.memberCount} size="small" variant="outlined" />
      ),
    },
    {
      key: 'shipCount',
      header: 'Ships',
      sortable: true,
      align: 'right',
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: row => (
        <Chip
          label={row.isActive ? 'Active' : 'Inactive'}
          size="small"
          sx={getStatusChipSx(row.isActive ? 'active' : 'inactive', theme)}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      render: row => (
        <Button size="small" onClick={() => onSelect(row)}>
          Manage
        </Button>
      ),
    },
  ];

  return (
    <DataTable<FleetV2>
      columns={columns}
      data={fleets}
      getRowKey={row => row.id}
      sortable
      paginated
      pageSize={10}
      onRowClick={onSelect}
      emptyMessage="No squadrons found"
      ariaLabel="Squadron list"
    />
  );
};

// ============================================================================
// Add Member Dialog
// ============================================================================

interface AddMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (userId: string, role?: string) => void;
  isPending: boolean;
}

const AddMemberDialog: React.FC<AddMemberDialogProps> = ({
  open,
  onClose,
  onSubmit,
  isPending,
}) => {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');

  const handleSubmit = () => {
    if (!userId.trim()) return;
    onSubmit(userId.trim(), role || undefined);
    setUserId('');
    setRole('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Squadron Member</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="User ID"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <FormControl fullWidth>
            <InputLabel>Role (optional)</InputLabel>
            <Select value={role} onChange={e => setRole(e.target.value)} label="Role (optional)">
              <MenuItem value="">None</MenuItem>
              <MenuItem value="leader">Leader</MenuItem>
              <MenuItem value="officer">Officer</MenuItem>
              <MenuItem value="pilot">Pilot</MenuItem>
              <MenuItem value="gunner">Gunner</MenuItem>
              <MenuItem value="engineer">Engineer</MenuItem>
              <MenuItem value="medic">Medic</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!userId.trim() || isPending}>
          Add Member
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Squadron Detail — member management for a single squadron
// ============================================================================

const SquadronDetail: React.FC<{
  fleet: FleetV2;
  onBack: () => void;
}> = ({ fleet, onBack }) => {
  const theme = useTheme();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<{
    squadronId: string;
    userId: string;
    name: string;
  }>();

  const { data: membersResult, isLoading, error } = useSquadronMembers(fleet.id);
  const { data: stats } = useSquadronStats(fleet.id);
  const addMember = useAddSquadronMember();
  const removeMember = useRemoveSquadronMember();
  const updateRole = useUpdateSquadronRole();

  const members = membersResult?.items ?? [];

  const handleAddMember = async (userId: string, role?: string) => {
    try {
      await addMember.mutateAsync({ squadronId: fleet.id, data: { userId, role } });
      setAddDialogOpen(false);
    } catch (err) {
      logger.error(
        'Failed to add squadron member',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleConfirmRemove = async () => {
    if (!pendingData) return;
    try {
      await removeMember.mutateAsync({
        squadronId: pendingData.squadronId,
        userId: pendingData.userId,
      });
      closeDialog();
    } catch (err) {
      logger.error(
        'Failed to remove squadron member',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateRole.mutateAsync({
        squadronId: fleet.id,
        userId,
        data: { role: newRole },
      });
    } catch (err) {
      logger.error(
        'Failed to update member role',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const columns: DataTableColumn<SquadronMember>[] = [
    {
      key: 'userId',
      header: 'User',
      sortable: true,
      render: row => (
        <Typography variant="body2" fontWeight="medium">
          {row.user?.username ?? row.userId}
        </Typography>
      ),
    },
    {
      key: 'rank',
      header: 'Rank',
      sortable: true,
      render: row => <Typography variant="body2">{row.rank ?? 'member'}</Typography>,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: row => (
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Select
            value={row.role ?? ''}
            onChange={e => handleRoleChange(row.userId, e.target.value)}
            displayEmpty
            variant="standard"
          >
            <MenuItem value="">—</MenuItem>
            <MenuItem value="leader">Leader</MenuItem>
            <MenuItem value="officer">Officer</MenuItem>
            <MenuItem value="pilot">Pilot</MenuItem>
            <MenuItem value="gunner">Gunner</MenuItem>
            <MenuItem value="engineer">Engineer</MenuItem>
            <MenuItem value="medic">Medic</MenuItem>
          </Select>
        </FormControl>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: row => (
        <Chip
          label={(row.status ?? 'active').toUpperCase()}
          size="small"
          sx={getStatusChipSx(row.status ?? 'active', theme)}
        />
      ),
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      sortable: true,
      render: row => (row.joinedAt ? new Date(row.joinedAt).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      render: row => (
        <Tooltip title="Remove member">
          <IconButton
            size="small"
            color="error"
            onClick={e => {
              e.stopPropagation();
              openDialog({
                squadronId: fleet.id,
                userId: row.userId,
                name: row.user?.username ?? row.userId,
              });
            }}
          >
            <PersonRemoveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <IconButton onClick={onBack}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">{fleet.name}</Typography>
          {fleet.description && (
            <Typography variant="body2" color="text.secondary">
              {fleet.description}
            </Typography>
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setAddDialogOpen(true)}
        >
          Add Member
        </Button>
      </Stack>

      {/* Stats bar */}
      {stats && (
        <Stack direction="row" spacing={2} mb={2}>
          <Chip label={`${stats.totalMembers} total`} variant="outlined" />
          <Chip label={`${stats.activeMembers} active`} color="success" variant="outlined" />
          {stats.byRole.map((r: { role: string; count: number }) => (
            <Chip key={r.role} label={`${r.role}: ${r.count}`} size="small" variant="outlined" />
          ))}
        </Stack>
      )}

      {/* Member table */}
      {isLoading && <ListSkeleton count={5} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load squadron members
        </Alert>
      )}
      {!isLoading && !error && members.length === 0 && (
        <EmptyState
          icon={GroupIcon}
          title="No members yet"
          description="Add members to this squadron to get started."
          actionLabel="Add Member"
          onAction={() => setAddDialogOpen(true)}
        />
      )}
      {!isLoading && members.length > 0 && (
        <DataTable<SquadronMember>
          columns={columns}
          data={members}
          getRowKey={row => row.id}
          sortable
          paginated
          pageSize={10}
          emptyMessage="No members found"
          ariaLabel="Squadron members"
        />
      )}

      {/* Dialogs */}
      <AddMemberDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubmit={handleAddMember}
        isPending={addMember.isPending}
      />

      <ConfirmDialog
        {...dialogProps}
        title="Remove Member"
        message={
          pendingData ? `Remove ${pendingData.name} from this squadron?` : 'Remove this member?'
        }
        confirmColor="error"
        onConfirm={handleConfirmRemove}
      />
    </Box>
  );
};

// ============================================================================
// Team-backed Squadron Detail — when fleet.teamId exists, uses team data
// ============================================================================

const TeamSquadronDetail: React.FC<{
  fleet: FleetV2;
  onBack: () => void;
}> = ({ fleet, onBack }) => {
  const theme = useTheme();
  const user = useAuthStore(state => state.user);
  const orgId = user?.activeOrgId ?? user?.organizationId ?? '';
  const teamId = fleet.teamId!;

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<{
    memberId: string;
    name: string;
  }>();

  const { data: members = [], isLoading, error } = useTeamMembers(teamId);
  const addMember = useAddTeamMember(teamId, orgId);
  const removeMember = useRemoveTeamMember(teamId, orgId);
  const updateMember = useUpdateTeamMember(teamId);

  const activeMembers = members.filter(m => m.status !== 'removed');

  const handleAddMember = async (userId: string, role?: string) => {
    try {
      await addMember.mutateAsync({
        userId,
        role: (role as TeamMemberRole) || 'member',
      });
      setAddDialogOpen(false);
    } catch (err) {
      logger.error(
        'Failed to add team member',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleConfirmRemove = async () => {
    if (!pendingData) return;
    try {
      await removeMember.mutateAsync(pendingData.memberId);
      closeDialog();
    } catch (err) {
      logger.error(
        'Failed to remove team member',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await updateMember.mutateAsync({
        memberId,
        data: { role: newRole as TeamMemberRole },
      });
    } catch (err) {
      logger.error(
        'Failed to update member role',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const columns: DataTableColumn<TeamMember>[] = [
    {
      key: 'userId',
      header: 'User',
      sortable: true,
      render: row => (
        <Typography variant="body2" fontWeight="medium">
          {row.user?.username ?? row.userId}
        </Typography>
      ),
    },
    {
      key: 'rank',
      header: 'Rank',
      sortable: true,
      render: row => <Typography variant="body2">{row.rank ?? 'member'}</Typography>,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: row => (
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Select
            value={row.role ?? ''}
            onChange={e => handleRoleChange(row.id, e.target.value)}
            displayEmpty
            variant="standard"
          >
            <MenuItem value="">—</MenuItem>
            <MenuItem value="leader">Leader</MenuItem>
            <MenuItem value="officer">Officer</MenuItem>
            <MenuItem value="pilot">Pilot</MenuItem>
            <MenuItem value="gunner">Gunner</MenuItem>
            <MenuItem value="engineer">Engineer</MenuItem>
            <MenuItem value="medic">Medic</MenuItem>
          </Select>
        </FormControl>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: row => (
        <Chip
          label={(row.status ?? 'active').toUpperCase()}
          size="small"
          sx={getStatusChipSx(row.status ?? 'active', theme)}
        />
      ),
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      sortable: true,
      render: row => (row.joinedAt ? new Date(row.joinedAt).toLocaleDateString() : '—'),
    },
    {
      key: 'specialization',
      header: 'Specialization',
      sortable: true,
      render: row => (
        <Typography variant="body2" color="text.secondary">
          {row.specialization ?? '—'}
        </Typography>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      render: row => (
        <Tooltip title="Remove member">
          <IconButton
            size="small"
            color="error"
            onClick={e => {
              e.stopPropagation();
              openDialog({
                memberId: row.id,
                name: row.user?.username ?? row.userId,
              });
            }}
          >
            <PersonRemoveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <IconButton onClick={onBack}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">{fleet.name}</Typography>
          {fleet.description && (
            <Typography variant="body2" color="text.secondary">
              {fleet.description}
            </Typography>
          )}
        </Box>
        <Chip label="Team-linked" size="small" color="info" variant="outlined" />
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setAddDialogOpen(true)}
        >
          Add Member
        </Button>
      </Stack>

      {/* Member table */}
      {isLoading && <ListSkeleton count={5} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load team members
        </Alert>
      )}
      {!isLoading && !error && activeMembers.length === 0 && (
        <EmptyState
          icon={GroupIcon}
          title="No members yet"
          description="Add members to this team squadron to get started."
          actionLabel="Add Member"
          onAction={() => setAddDialogOpen(true)}
        />
      )}
      {!isLoading && activeMembers.length > 0 && (
        <DataTable<TeamMember>
          columns={columns}
          data={activeMembers}
          getRowKey={row => row.id}
          sortable
          paginated
          pageSize={10}
          emptyMessage="No members found"
          ariaLabel="Team squadron members"
        />
      )}

      {/* Dialogs */}
      <AddMemberDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubmit={handleAddMember}
        isPending={addMember.isPending}
      />

      <ConfirmDialog
        {...dialogProps}
        title="Remove Member"
        message={
          pendingData ? `Remove ${pendingData.name} from this squadron?` : 'Remove this member?'
        }
        confirmColor="error"
        onConfirm={handleConfirmRemove}
      />
    </Box>
  );
};

// ============================================================================
// SquadronList — main export
// ============================================================================

export const SquadronList: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const orgId = user?.activeOrgId ?? user?.organizationId;

  const { data: fleetsResult, isLoading, error, refetch } = useFleets(orgId);
  const [selectedFleet, setSelectedFleet] = useState<FleetV2 | null>(null);

  const fleets = fleetsResult?.items ?? [];

  if (selectedFleet) {
    if (selectedFleet.teamId) {
      return <TeamSquadronDetail fleet={selectedFleet} onBack={() => setSelectedFleet(null)} />;
    }
    return <SquadronDetail fleet={selectedFleet} onBack={() => setSelectedFleet(null)} />;
  }

  if (isLoading) {
    return <ListSkeleton count={5} />;
  }

  if (error) {
    return <ErrorMessage message="Failed to load squadrons" onRetry={() => refetch()} />;
  }

  if (fleets.length === 0) {
    return (
      <EmptyState
        icon={GroupIcon}
        title="No squadrons"
        description="Create a fleet first, then manage its squadron members here."
      />
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Squadrons</Typography>
      </Stack>
      <SquadronOverview fleets={fleets} onSelect={setSelectedFleet} />
    </Box>
  );
};
