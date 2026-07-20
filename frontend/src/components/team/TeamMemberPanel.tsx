/**
 * TeamMemberPanel — Wave 2.6 Teams/Squads System
 *
 * Displays and manages members of a selected team.
 * Uses the shared MemberPanel component for consistent member list rendering.
 */

import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type {
  AddTeamMemberRequest,
  TeamMember,
  TeamMemberRole,
  TeamMemberStatus,
  UpdateTeamMemberRequest,
} from '@sc-fleet-manager/shared-types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MemberPanel } from '@/components/shared';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import { logger } from '@/utils/logger';

/** Shape of an org member option for the autocomplete */
interface OrgMemberOption {
  id: string;
  userId: string;
  displayName: string;
  username: string;
}

interface TeamMemberPanelProps {
  teamId: string;
  teamName: string;
  organizationId: string;
  members: TeamMember[];
  maxMembers: number;
  onAddMember: (data: AddTeamMemberRequest) => void;
  onUpdateMember: (memberId: string, data: UpdateTeamMemberRequest) => void;
  onRemoveMember: (memberId: string) => void;
  loading?: boolean;
}

const STATUS_OPTIONS: { value: TeamMemberStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'probation', label: 'Probation' },
  { value: 'deployed', label: 'Deployed' },
];

export const TeamMemberPanel: React.FC<TeamMemberPanelProps> = ({
  teamName,
  organizationId,
  members,
  maxMembers,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
  loading,
}) => {
  const theme = useTheme();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OrgMemberOption | null>(null);
  const [addRole, setAddRole] = useState<TeamMemberRole>('member');
  const [addRank, setAddRank] = useState('');
  const [addSpecialization, setAddSpecialization] = useState('');
  const [addShipType, setAddShipType] = useState('');

  // Member search state
  const [memberOptions, setMemberOptions] = useState<OrgMemberOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const activeMembers = useMemo(() => members.filter(m => m.status !== 'removed'), [members]);
  const existingUserIds = useMemo(() => new Set(activeMembers.map(m => m.userId)), [activeMembers]);
  const atCapacity = activeMembers.length >= maxMembers;

  const resetAddForm = () => {
    setSelectedMember(null);
    setAddRole('member');
    setAddRank('');
    setAddSpecialization('');
    setAddShipType('');
    setMemberOptions([]);
  };

  const handleSearchMembers = useCallback(
    (query: string) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (!query || query.length < 2 || !organizationId) {
        setMemberOptions([]);
        return;
      }
      setSearchLoading(true);
      searchTimer.current = setTimeout(async () => {
        try {
          const result = await organizationServiceV2.getOrganizationMembers(organizationId, {
            search: query,
            page: 1,
            limit: 15,
          });
          const options = (result.items || [])
            .filter(m => !existingUserIds.has(m.userId))
            .map(m => ({
              id: m.userId,
              userId: m.userId,
              displayName: m.displayName || m.username || m.userId,
              username: m.username || m.userId,
            }));
          setMemberOptions(options);
        } catch (err) {
          logger.error(
            'Failed to search members',
            err instanceof Error ? err : new Error(String(err))
          );
          setMemberOptions([]);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
    },
    [organizationId, existingUserIds]
  );

  const handleAdd = () => {
    if (selectedMember) {
      const data: AddTeamMemberRequest = { userId: selectedMember.userId, role: addRole };
      if (addRank.trim()) data.rank = addRank.trim();
      if (addSpecialization.trim()) data.specialization = addSpecialization.trim();
      if (addShipType.trim()) data.shipType = addShipType.trim();
      onAddMember(data);
      resetAddForm();
      setShowAddDialog(false);
    }
  };

  return (
    <Box>
      <MemberPanel<TeamMember>
        members={activeMembers}
        getMemberId={m => m.id}
        getMemberUserId={m => m.userId}
        getMemberName={m => m.user?.displayName || m.user?.username || m.userId}
        getMemberUsername={m => m.user?.username}
        getMemberAvatar={m => m.user?.avatar || undefined}
        getMemberRole={m => m.role}
        getMemberJoinedAt={m => m.joinedAt}
        renderRole={m => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              value={m.role}
              size="small"
              onChange={e => onUpdateMember(m.id, { role: e.target.value as TeamMemberRole })}
              sx={{ minWidth: 100 }}
            >
              <MenuItem value="leader">Leader</MenuItem>
              <MenuItem value="officer">Officer</MenuItem>
              <MenuItem value="member">Member</MenuItem>
            </Select>
            <Select
              value={m.status}
              size="small"
              onChange={e => onUpdateMember(m.id, { status: e.target.value as TeamMemberStatus })}
              sx={{ minWidth: 100 }}
            >
              {STATUS_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {m.rank && <Chip label={m.rank} size="small" variant="outlined" />}
            {m.specialization && <Chip label={m.specialization} size="small" variant="outlined" />}
          </Stack>
        )}
        onRemove={m => onRemoveMember(m.id)}
        loading={loading}
        title={teamName}
        subtitle={`${activeMembers.length}/${maxMembers} members`}
        toolbarActions={
          <Button
            startIcon={<PersonAddIcon />}
            variant="outlined"
            size="small"
            disabled={atCapacity || loading}
            onClick={() => setShowAddDialog(true)}
            sx={{
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                borderColor: 'primary.dark',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            Add Member
          </Button>
        }
        emptyContent={
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            No members yet. Add members to this team to get started.
          </Typography>
        }
        pageSizeOptions={false}
      />

      {/* Add Member Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          resetAddForm();
        }}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
            },
          },
        }}
      >
        <DialogTitle>Add Team Member</DialogTitle>
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}
        >
          <Autocomplete
            options={memberOptions}
            value={selectedMember}
            onChange={(_, val) => setSelectedMember(val)}
            onInputChange={(_, value, reason) => {
              if (reason === 'input') handleSearchMembers(value);
            }}
            loading={searchLoading}
            getOptionLabel={option => option.displayName}
            isOptionEqualToValue={(opt, val) => opt.userId === val.userId}
            filterOptions={x => x}
            renderOption={(props, option) => {
              const { key, ...rest } = props;
              return (
                <Box component="li" key={key} {...rest}>
                  <Stack>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.displayName}
                    </Typography>
                    {option.username !== option.displayName && (
                      <Typography variant="caption" color="text.secondary">
                        @{option.username}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              );
            }}
            renderInput={params => (
              <TextField
                {...params}
                label="Member"
                required
                placeholder="Search org members..."
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {searchLoading ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
            noOptionsText={searchLoading ? 'Searching...' : 'Type 2+ chars to search'}
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={addRole}
              label="Role"
              onChange={e => setAddRole(e.target.value as TeamMemberRole)}
            >
              <MenuItem value="leader">Leader</MenuItem>
              <MenuItem value="officer">Officer</MenuItem>
              <MenuItem value="member">Member</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Rank"
            value={addRank}
            onChange={e => setAddRank(e.target.value)}
            fullWidth
            placeholder="e.g., Captain, Lieutenant"
          />
          <TextField
            label="Specialization"
            value={addSpecialization}
            onChange={e => setAddSpecialization(e.target.value)}
            fullWidth
            placeholder="e.g., Combat Pilot, Mining Ops"
          />
          <TextField
            label="Ship Type"
            value={addShipType}
            onChange={e => setAddShipType(e.target.value)}
            fullWidth
            placeholder="e.g., Constellation Andromeda"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setShowAddDialog(false);
              resetAddForm();
            }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            variant="contained"
            disabled={!selectedMember || loading}
            sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
