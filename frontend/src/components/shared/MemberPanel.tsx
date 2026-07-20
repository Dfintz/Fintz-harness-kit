/**
 * MemberPanel — Generic, reusable member list component.
 *
 * Replaces the duplicated member-list patterns found across TeamMemberPanel,
 * OrgMemberManagement, OrgMembersTab, and CrewManagementDialog.
 *
 * Features:
 * - Avatar with image or initials fallback
 * - Name + username subtitle
 * - Role display (chip or custom render prop)
 * - Joined date
 * - Search filtering
 * - Client-side pagination
 * - Optional inline role editing
 * - Optional remove action
 * - Row click handler
 * - Loading / error / empty states
 * - Slot for toolbar actions (add member button, filters, etc.)
 *
 * @example
 * <MemberPanel<TeamMember>
 *   members={members}
 *   getMemberId={(m) => m.id}
 *   getMemberUserId={(m) => m.userId}
 *   getMemberName={(m) => m.user?.displayName ?? m.user?.username ?? m.userId}
 *   getMemberAvatar={(m) => m.user?.avatar}
 *   getMemberRole={(m) => m.role}
 *   onRemove={(m) => handleRemove(m.id)}
 *   loading={isLoading}
 * />
 */

import { sanitizeImageUrl } from '@/utils/sanitize';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Avatar,
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
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
import React, { useCallback, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MemberPanelProps<T> {
  /** Array of member objects to display. */
  members: T[];

  /** Extract a unique id for each member row (React key). */
  getMemberId: (member: T) => string;

  /** Extract the user's id. Used for avatar colour & initials fallback. */
  getMemberUserId: (member: T) => string;

  /**
   * Display name for the member.  Return `undefined` to fall back to userId.
   */
  getMemberName: (member: T) => string | undefined;

  /**
   * Optional username (shown as @username subtitle when different from name).
   */
  getMemberUsername?: (member: T) => string | undefined;

  /**
   * Avatar image URL. When undefined, an initials avatar is rendered.
   */
  getMemberAvatar?: (member: T) => string | undefined;

  /**
   * Role string for the member (used by default role chip).
   */
  getMemberRole?: (member: T) => string;

  /**
   * Joined-at date string or Date for the member.
   */
  getMemberJoinedAt?: (member: T) => string | Date | undefined;

  // --- Custom rendering ---

  /**
   * Override default role rendering. Return a custom Chip, Select, etc.
   */
  renderRole?: (member: T) => React.ReactNode;

  /**
   * Render additional columns/content after the default columns.
   */
  renderExtra?: (member: T) => React.ReactNode;

  /**
   * Render trailing action buttons. When provided, replaces the default
   * remove button.
   */
  renderActions?: (member: T) => React.ReactNode;

  // --- Interaction ---

  /** Called when the remove button is clicked (only shown if provided). */
  onRemove?: (member: T) => void;

  /** Called when a member row is clicked. Makes rows appear clickable. */
  onRowClick?: (member: T) => void;

  // --- Search & pagination ---

  /** Enable the search bar. Filters on name, username, userId, and role. */
  searchable?: boolean;

  /** Page size options for pagination. Set to `false` to disable pagination. */
  pageSizeOptions?: number[] | false;

  /** Default page size. @default 10 */
  defaultPageSize?: number;

  // --- States ---

  /** Show a loading spinner instead of the table. */
  loading?: boolean;

  /** Show an error alert. */
  error?: string;

  /** Content to display when the member list is empty. */
  emptyContent?: React.ReactNode;

  // --- Toolbar ---

  /** Title shown at the top of the panel. */
  title?: string;

  /** Member count / capacity string shown next to the title. */
  subtitle?: string;

  /** Custom toolbar content (e.g. "Add Member" button, role filter). */
  toolbarActions?: React.ReactNode;

  /** Extra header columns (labels only). Pair with `renderExtra`. */
  extraColumnHeaders?: string[];

  /** Optional sx on the root Box. */
  sx?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple deterministic colour from a string (for avatar fallback). */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 45%)`;
}

function getInitials(name: string | undefined): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDate(d: string | Date | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberPanel<T>({
  members,
  getMemberId,
  getMemberUserId,
  getMemberName,
  getMemberUsername,
  getMemberAvatar,
  getMemberRole,
  getMemberJoinedAt,
  renderRole,
  renderExtra,
  renderActions,
  onRemove,
  onRowClick,
  searchable = false,
  pageSizeOptions = [10, 25, 50],
  defaultPageSize = 10,
  loading = false,
  error,
  emptyContent,
  title,
  subtitle,
  toolbarActions,
  extraColumnHeaders,
  sx,
}: MemberPanelProps<T>): React.ReactElement {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultPageSize);

  // --- Filtering ---
  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m => {
      const name = getMemberName(m) ?? '';
      const username = getMemberUsername?.(m) ?? '';
      const userId = getMemberUserId(m);
      const role = getMemberRole?.(m) ?? '';
      return (
        name.toLowerCase().includes(q) ||
        username.toLowerCase().includes(q) ||
        userId.toLowerCase().includes(q) ||
        role.toLowerCase().includes(q)
      );
    });
  }, [members, search, getMemberName, getMemberUsername, getMemberUserId, getMemberRole]);

  // --- Pagination ---
  const paginationEnabled = pageSizeOptions !== false;
  const displayed = paginationEnabled
    ? filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : filtered;

  const handlePageChange = useCallback((_: unknown, newPage: number) => setPage(newPage), []);
  const handleRowsPerPage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  // Reset page when search changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(0);
  }, []);

  // --- Determine visible columns ---
  const showRole = !!(getMemberRole || renderRole);
  const showJoined = !!getMemberJoinedAt;
  const showActions = !!(onRemove || renderActions);
  const showExtra = !!renderExtra;

  // --- Loading ---
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, ...sx }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <Box sx={{ p: 2, ...sx }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={sx}>
      {/* Toolbar */}
      {(title || searchable || toolbarActions) && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
        >
          <Stack direction="row" alignItems="baseline" spacing={1}>
            {title && (
              <Typography variant="h6" component="div">
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            {searchable && (
              <TextField
                size="small"
                placeholder="Search members…"
                value={search}
                onChange={handleSearchChange}
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
            )}
            {toolbarActions}
          </Stack>
        </Stack>
      )}

      {/* Empty */}
      {members.length === 0 && !loading ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          {emptyContent ?? (
            <Typography variant="body2" color="text.secondary">
              No members to display.
            </Typography>
          )}
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  {showRole && <TableCell>Role</TableCell>}
                  {showJoined && <TableCell>Joined</TableCell>}
                  {extraColumnHeaders?.map(h => (
                    <TableCell key={h}>{h}</TableCell>
                  ))}
                  {showActions && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayed.map(member => {
                  const id = getMemberId(member);
                  const userId = getMemberUserId(member);
                  const name = getMemberName(member) ?? userId;
                  const username = getMemberUsername?.(member);
                  const avatar = getMemberAvatar?.(member);
                  const role = getMemberRole?.(member);
                  const joined = getMemberJoinedAt?.(member);

                  return (
                    <TableRow
                      key={id}
                      hover
                      onClick={onRowClick ? () => onRowClick(member) : undefined}
                      sx={{
                        cursor: onRowClick ? 'pointer' : undefined,
                      }}
                    >
                      {/* Member cell: avatar + name */}
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar
                            src={sanitizeImageUrl(avatar) || undefined}
                            alt={name}
                            sx={{
                              width: 30,
                              height: 30,
                              fontSize: '0.75rem',
                              bgcolor: avatar ? undefined : stringToColor(userId),
                            }}
                          >
                            {getInitials(name)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {name}
                            </Typography>
                            {username && username !== name && (
                              <Typography variant="caption" color="text.secondary" noWrap>
                                @{username}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </TableCell>

                      {/* Role cell */}
                      {showRole && (
                        <TableCell>
                          {renderRole
                            ? renderRole(member)
                            : role && (
                                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                  {role}
                                </Typography>
                              )}
                        </TableCell>
                      )}

                      {/* Joined cell */}
                      {showJoined && (
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(joined)}
                          </Typography>
                        </TableCell>
                      )}

                      {/* Extra columns */}
                      {showExtra && <TableCell>{renderExtra(member)}</TableCell>}

                      {/* Actions cell */}
                      {showActions && (
                        <TableCell align="right">
                          {renderActions ? (
                            renderActions(member)
                          ) : onRemove ? (
                            <Tooltip title="Remove member">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={e => {
                                  e.stopPropagation();
                                  onRemove(member);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {/* No results after search */}
                {displayed.length === 0 && members.length > 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={
                        1 +
                        (showRole ? 1 : 0) +
                        (showJoined ? 1 : 0) +
                        (extraColumnHeaders?.length ?? 0) +
                        (showActions ? 1 : 0)
                      }
                      align="center"
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No members match &ldquo;{search}&rdquo;
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {paginationEnabled && filtered.length > rowsPerPage && (
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPage}
              rowsPerPageOptions={pageSizeOptions as number[]}
            />
          )}
        </>
      )}
    </Box>
  );
}
