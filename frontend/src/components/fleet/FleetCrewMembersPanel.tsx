/**
 * FleetCrewMembersPanel
 *
 * Displays a table of all crew members in a fleet with their ship
 * assignments, roles, and status.  Provides visibility into who is
 * assigned where and who is pending approval.
 */

import { useFleetCrewMembers } from '@/hooks/queries/useFleetQueries';
import { getRoleBgColor, getRoleColor, getRoleLabel } from '@/utils/crewRoleHelpers';
import { sanitizeImageUrl } from '@/utils/sanitize';
import GroupsIcon from '@mui/icons-material/Groups';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

interface FleetCrewMembersPanelProps {
  fleetId: string;
}

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  active: 'success',
  deployed: 'info',
  pending: 'warning',
  inactive: 'default',
  on_leave: 'default',
  removed: 'error',
};

export const FleetCrewMembersPanel: React.FC<Readonly<FleetCrewMembersPanelProps>> = ({
  fleetId,
}) => {
  const theme = useTheme();
  const { data, isLoading, error } = useFleetCrewMembers(fleetId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load crew members</Alert>;
  }

  const members = data?.members ?? [];

  if (members.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <GroupsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
        <Typography color="text.secondary">No crew members assigned yet</Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
          Members will appear here once they join the fleet&apos;s crew team.
        </Typography>
      </Box>
    );
  }

  const activeMembers = members.filter(m => m.status === 'active' || m.status === 'deployed');
  const pendingMembers = members.filter(m => m.status === 'pending');

  return (
    <Stack spacing={2}>
      {/* Summary chips */}
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip
          size="small"
          label={`${activeMembers.length} active`}
          sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' }}
        />
        {pendingMembers.length > 0 && (
          <Chip
            size="small"
            icon={<HourglassEmptyIcon sx={{ fontSize: 14 }} />}
            label={`${pendingMembers.length} pending`}
            sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: 'warning.main' }}
          />
        )}
      </Stack>

      {/* Members table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Member</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Team Role</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Ship Assignment</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Crew Role</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member, index) => (
              <TableRow key={member.userId} hover>
                <TableCell>
                  <Typography variant="caption" color="text.disabled">
                    {index + 1}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar
                      src={sanitizeImageUrl(member.avatar) || undefined}
                      sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
                    >
                      {member.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {member.displayName || member.username}
                      </Typography>
                      {member.displayName && member.displayName !== member.username && (
                        <Typography variant="caption" color="text.disabled">
                          @{member.username}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {member.role}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={member.status.replace('_', ' ')}
                    color={STATUS_COLORS[member.status] || 'default'}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22, textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell>
                  {member.assignedShipName ? (
                    <Typography variant="body2">{member.assignedShipName}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      —
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {member.crewRole ? (
                    <Chip
                      size="small"
                      label={getRoleLabel(member.crewRole)}
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: getRoleBgColor(member.crewRole),
                        color: getRoleColor(member.crewRole),
                      }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      —
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};
