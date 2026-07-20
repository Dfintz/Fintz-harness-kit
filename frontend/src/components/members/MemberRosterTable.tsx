/**
 * MemberRosterTable — Full member data table with inline actions
 *
 * Features:
 * - Sortable, filterable member list
 * - Inline role change
 * - Remove member action with confirmation
 * - Search by name
 * - Role filter
 *
 * Wave 3.3 — Member Management Redesign
 */
import { useOrganizationMembers } from '@/hooks/queries/useOrganizationQueries';
import { useAuthStore } from '@/store/authStore';
import { sanitizeImageUrl } from '@/utils/sanitize';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface MemberRosterTableProps {
  readonly organizationId: string;
  readonly isAdmin: boolean;
  readonly onRoleChange?: (userId: string, newRole: string) => void;
  readonly onRemoveMember?: (userId: string) => void;
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
      return 'primary';
    case 'officer':
      return 'primary';
    case 'recruit':
      return 'default';
    default:
      return 'default';
  }
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) {
    return '—';
  }
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// Component
// ============================================================================

export const MemberRosterTable: React.FC<MemberRosterTableProps> = ({
  organizationId,
  isAdmin,
  onRoleChange,
  onRemoveMember,
}) => {
  const currentUserId = useAuthStore(state => state.user?.id);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);

  const { data, isLoading, error } = useOrganizationMembers(organizationId, {
    page: page + 1,
    limit: pageSize,
    search: search || undefined,
    role: roleFilter || undefined,
  });

  const handleRemoveConfirm = () => {
    if (removeTarget && onRemoveMember) {
      onRemoveMember(removeTarget.userId);
    }
    setRemoveTarget(null);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load organization members.</Alert>;
  }

  const members = data?.items ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search members..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setPage(0);
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 200 }}
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="role-filter-label">Role</InputLabel>
          <Select
            labelId="role-filter-label"
            value={roleFilter}
            label="Role"
            onChange={e => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">All Roles</MenuItem>
            <MenuItem value="founder">Founder</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="senior_officer">Senior Officer</MenuItem>
            <MenuItem value="officer">Officer</MenuItem>
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="recruit">Recruit</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="body2" color="text.secondary">
          {total} member{total === 1 ? '' : 's'}
        </Typography>
      </Stack>

      {/* Members Table */}
      {members.length > 0 ? (
        <>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>RSI / Discord</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>RSI Verified</TableCell>
                  <TableCell>Team</TableCell>
                  <TableCell>Ship / Crew Role</TableCell>
                  <TableCell>Registered</TableCell>
                  <TableCell>Last Login</TableCell>
                  <TableCell>Org Joined</TableCell>
                  {isAdmin && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map(member => (
                  <TableRow key={member.userId} hover>
                    {/* Web app identity */}
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          src={sanitizeImageUrl(member.avatar) || undefined}
                          alt={member.displayName ?? member.username}
                          sx={{ width: 32, height: 32 }}
                        >
                          {(member.displayName ?? member.username ?? '?')[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {member.displayName ?? member.username ?? 'Unknown'}
                          </Typography>
                          {member.username &&
                            member.displayName &&
                            member.displayName !== member.username && (
                              <Typography variant="caption" color="text.secondary">
                                @{member.username}
                              </Typography>
                            )}
                        </Box>
                      </Stack>
                    </TableCell>

                    {/* RSI handle + Discord ID */}
                    <TableCell>
                      <Box>
                        {member.rsiHandle ? (
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
                            RSI: {member.rsiHandle}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            No RSI handle
                          </Typography>
                        )}
                        {member.discordId ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Discord: {member.discordId}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.disabled" display="block">
                            No Discord linked
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {isAdmin && onRoleChange && member.userId !== currentUserId ? (
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={member.role}
                            onChange={e => onRoleChange(member.userId, e.target.value)}
                            variant="standard"
                            disableUnderline
                          >
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="senior_officer">Senior Officer</MenuItem>
                            <MenuItem value="officer">Officer</MenuItem>
                            <MenuItem value="member">Member</MenuItem>
                            <MenuItem value="recruit">Recruit</MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip
                          label={member.role}
                          color={getRoleColor(member.role)}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    {/* RSI Verified */}
                    <TableCell>
                      {member.rsiVerified ? (
                        <Tooltip title="RSI identity verified">
                          <CheckCircleIcon fontSize="small" color="success" />
                        </Tooltip>
                      ) : (
                        <Tooltip title="RSI not verified">
                          <ErrorOutlineIcon fontSize="small" color="warning" />
                        </Tooltip>
                      )}
                    </TableCell>

                    {/* Team memberships */}
                    <TableCell>
                      {member.teams && member.teams.length > 0 ? (
                        <Stack spacing={0.3}>
                          {member.teams.map(t => (
                            <Box key={t.teamName}>
                              <Typography
                                variant="body2"
                                sx={{ fontSize: '0.8rem', fontWeight: 500 }}
                              >
                                {t.teamName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t.teamRole}
                                {t.rank ? ` · ${t.rank}` : ''}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          No team
                        </Typography>
                      )}
                    </TableCell>

                    {/* Ship / Crew role */}
                    <TableCell>
                      {member.crewAssignments && member.crewAssignments.length > 0 ? (
                        <Stack spacing={0.3}>
                          {member.crewAssignments.map(c => (
                            <Typography
                              key={`${c.shipId}-${c.crewRole}`}
                              variant="body2"
                              sx={{ fontSize: '0.8rem' }}
                            >
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                              >
                                {c.shipId.slice(0, 8)}
                              </Typography>
                              {' · '}
                              <Chip
                                label={c.crewRole}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 18 }}
                              />
                            </Typography>
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          No assignment
                        </Typography>
                      )}
                    </TableCell>

                    {/* Account registered date */}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(member.registeredAt)}
                      </Typography>
                    </TableCell>

                    {/* Last login */}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(member.lastLoginAt)}
                      </Typography>
                    </TableCell>

                    {/* Org joined date */}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(member.joinedAt)}
                      </Typography>
                    </TableCell>
                    {isAdmin && (
                      <TableCell align="right">
                        {member.userId !== currentUserId && (
                          <Tooltip title="Remove member">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                setRemoveTarget({
                                  userId: member.userId,
                                  name: member.displayName ?? member.username ?? member.userId,
                                })
                              }
                            >
                              <PersonRemoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={e => {
              setPageSize(Number.parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </>
      ) : (
        <Alert severity="info">No members found matching the current filters.</Alert>
      )}

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)}>
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove <strong>{removeTarget?.name}</strong> from the
            organization? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button onClick={handleRemoveConfirm} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
