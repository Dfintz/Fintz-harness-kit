import { Divider } from '@/components/ui/Divider';
import { TypographyArea } from '@/components/ui/SpectrumCompat';
import {
  useAddMessage,
  useCloseTicket,
  useCreateTicket,
  useResolveTicket,
  useTickets,
} from '@/hooks/queries/useTicketQueries';
import { OrganizationMemberV2, organizationServiceV2 } from '@/services/organizationServiceV2';
import {
  type Ticket,
  TicketCategory,
  TicketPriority,
  TicketRecipientType,
  TicketStatus,
} from '@/services/ticketService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import {
  AccessTime,
  AccountBalance,
  Assignment,
  Build,
  Chat,
  ChatBubble,
  Close,
  Groups,
  Handshake,
  MilitaryTech,
  Person,
  Refresh,
  Shield,
  Star,
} from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { PageHeader } from './PageHeader';

import Add from '@mui/icons-material/Add';

// Recipient type configuration — grouped by routing category
interface RecipientTypeInfo {
  icon: React.ReactNode;
  label: string;
  description: string;
  group: 'role' | 'function' | 'direct';
}

const RECIPIENT_TYPE_CONFIG: Record<TicketRecipientType, RecipientTypeInfo> = {
  // Role-based routing
  [TicketRecipientType.ORG_LEADERSHIP]: {
    icon: <Star fontSize="small" />,
    label: 'Org Leadership',
    description: 'Organization owners & admins',
    group: 'role',
  },
  [TicketRecipientType.ORG_OFFICERS]: {
    icon: <Shield fontSize="small" />,
    label: 'Org Officers',
    description: 'Internal organization officers',
    group: 'role',
  },
  [TicketRecipientType.TEAM_LEADER]: {
    icon: <MilitaryTech fontSize="small" />,
    label: 'Team Leader',
    description: 'Team leaders within the organization',
    group: 'role',
  },
  [TicketRecipientType.ALLIANCE_COUNCIL]: {
    icon: <AccountBalance fontSize="small" />,
    label: 'Alliance Council',
    description: 'Federation / alliance council & leaders',
    group: 'role',
  },
  // Function-based routing
  [TicketRecipientType.HR_DEPARTMENT]: {
    icon: <Groups fontSize="small" />,
    label: 'HR Department',
    description: 'Human resources & personnel',
    group: 'function',
  },
  [TicketRecipientType.RECRUITMENT]: {
    icon: <Assignment fontSize="small" />,
    label: 'Recruitment',
    description: 'Recruitment & applications',
    group: 'function',
  },
  [TicketRecipientType.DIPLOMACY]: {
    icon: <Handshake fontSize="small" />,
    label: 'Diplomacy',
    description: 'Diplomacy & external relations',
    group: 'function',
  },
  // Direct routing
  [TicketRecipientType.SPECIFIC_USER]: {
    icon: <Person fontSize="small" />,
    label: 'Specific User',
    description: 'Send directly to a specific member',
    group: 'direct',
  },
  [TicketRecipientType.PLATFORM_ADMIN]: {
    icon: <Shield fontSize="small" />,
    label: 'Platform Admin',
    description: 'Platform-level administrators',
    group: 'direct',
  },
};

const GROUP_LABELS: Record<string, string> = {
  role: 'Role-Based',
  function: 'Department / Function',
  direct: 'Direct',
};

// Priority badge variant mapping
const PRIORITY_BADGE_VARIANT: Record<
  TicketPriority,
  'positive' | 'negative' | 'neutral' | 'notice' | 'info'
> = {
  [TicketPriority.LOW]: 'positive',
  [TicketPriority.MEDIUM]: 'notice',
  [TicketPriority.HIGH]: 'notice',
  [TicketPriority.URGENT]: 'negative',
};

// Priority colors and icons
const PRIORITY_CONFIG: Record<TicketPriority, { color: string; label: string }> = {
  [TicketPriority.LOW]: { color: 'green', label: 'Low' },
  [TicketPriority.MEDIUM]: { color: 'yellow', label: 'Medium' },
  [TicketPriority.HIGH]: { color: 'orange', label: 'High' },
  [TicketPriority.URGENT]: { color: 'red', label: 'Urgent' },
};

// Category configuration
const CATEGORY_CONFIG: Record<TicketCategory, { icon: React.ReactNode; label: string }> = {
  [TicketCategory.HR]: { icon: <Groups fontSize="small" />, label: 'HR' },
  [TicketCategory.RECRUITMENT]: { icon: <Assignment fontSize="small" />, label: 'Recruitment' },
  [TicketCategory.DIPLOMACY]: { icon: <Handshake fontSize="small" />, label: 'Diplomacy' },
  [TicketCategory.GENERAL]: { icon: <Chat fontSize="small" />, label: 'General' },
  [TicketCategory.SUPPORT]: { icon: <Build fontSize="small" />, label: 'Support' },
};

// Status configuration
const STATUS_CONFIG: Record<TicketStatus, { label: string }> = {
  [TicketStatus.OPEN]: { label: 'Open' },
  [TicketStatus.IN_PROGRESS]: { label: 'In Progress' },
  [TicketStatus.AWAITING_RESPONSE]: { label: 'Awaiting Response' },
  [TicketStatus.ON_HOLD]: { label: 'On Hold' },
  [TicketStatus.RESOLVED]: { label: 'Resolved' },
  [TicketStatus.CLOSED]: { label: 'Closed' },
};

/** Map priority badge variant to MUI Chip color */
function getPriorityChipColor(
  priority: TicketPriority
): 'success' | 'error' | 'warning' | 'default' {
  const variant = PRIORITY_BADGE_VARIANT[priority];
  if (variant === 'positive') return 'success';
  if (variant === 'negative') return 'error';
  if (variant === 'notice') return 'warning';
  return 'default';
}

/** Extract error message from query error */
function getQueryErrorMessage(queryError: Error | null): string | null {
  if (!queryError) return null;
  return queryError instanceof Error ? queryError.message : 'Failed to load tickets';
}

export const TicketManagement: React.FC = () => {
  const theme = useTheme();
  const [selectedTab, setSelectedTab] = useState<string>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Auth & org context
  const user = useAuthStore(state => state.user);

  // React Query hooks
  const ticketFilters = {
    status: selectedTab === 'all' ? undefined : selectedTab,
    searchTerm: searchTerm || undefined,
  };
  const {
    data: ticketData,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useTickets(ticketFilters);
  const tickets = ticketData?.data ?? [];
  const error = getQueryErrorMessage(queryError);

  const createTicketMutation = useCreateTicket();
  const addMessageMutation = useAddMessage();
  const closeTicketMutation = useCloseTicket();
  const _resolveTicketMutation = useResolveTicket();

  // Org members for specific-user recipient
  const [orgMembers, setOrgMembers] = useState<OrganizationMemberV2[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<OrganizationMemberV2 | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  // Form state for new ticket
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: TicketCategory.GENERAL as TicketCategory,
    priority: TicketPriority.MEDIUM as TicketPriority,
    recipientType: '' as TicketRecipientType | '',
  });

  // Reply form state
  const [replyContent, setReplyContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Load org members when "Specific User" is selected
  const activeOrgId = user?.organizationId;
  useEffect(() => {
    if (
      newTicket.recipientType === TicketRecipientType.SPECIFIC_USER &&
      activeOrgId &&
      orgMembers.length === 0
    ) {
      const loadMembers = async () => {
        try {
          setMembersLoading(true);
          const result = await organizationServiceV2.getOrganizationMembers(activeOrgId, {
            limit: 200,
          });
          setOrgMembers(result.items ?? []);
        } catch (err) {
          logger.error(
            'Failed to load org members',
            err instanceof Error ? err : new Error(String(err))
          );
        } finally {
          setMembersLoading(false);
        }
      };
      void loadMembers();
    }
    // Clear selected recipient when switching away from specific user
    if (newTicket.recipientType !== TicketRecipientType.SPECIFIC_USER) {
      setSelectedRecipient(null);
    }
  }, [newTicket.recipientType, activeOrgId, orgMembers.length]);

  const handleCreateTicket = async () => {
    try {
      await createTicketMutation.mutateAsync({
        ...newTicket,
        recipientType: newTicket.recipientType as TicketRecipientType,
        ...(newTicket.recipientType === TicketRecipientType.SPECIFIC_USER && selectedRecipient
          ? {
              recipientId: selectedRecipient.userId,
              recipientName:
                selectedRecipient.displayName ||
                selectedRecipient.username ||
                selectedRecipient.userId,
            }
          : {}),
      });
      setShowCreateDialog(false);
      setNewTicket({
        subject: '',
        description: '',
        category: TicketCategory.GENERAL,
        priority: TicketPriority.MEDIUM,
        recipientType: '',
      });
      setSelectedRecipient(null);
    } catch (err: unknown) {
      logger.error('Failed to create ticket', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleAddReply = async () => {
    if (!selectedTicket || !replyContent.trim()) return;

    try {
      const updated = await addMessageMutation.mutateAsync({
        ticketId: selectedTicket.id,
        data: { content: replyContent, isInternal: isInternalNote },
      });
      setReplyContent('');
      setIsInternalNote(false);
      setSelectedTicket(updated);
    } catch (err: unknown) {
      logger.error('Failed to add reply', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    try {
      await closeTicketMutation.mutateAsync(ticketId);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
    } catch (err: unknown) {
      logger.error('Failed to close ticket', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const _handleResolveTicket = async (ticketId: string, resolution: string) => {
    try {
      await _resolveTicketMutation.mutateAsync({ ticketId, data: { resolution } });
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
    } catch (err: unknown) {
      logger.error('Failed to resolve ticket', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  if (loading && tickets.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <Box p={4} width="100%">
      <Stack direction="column" spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <PageHeader
            title="🎫 Ticket Management"
            description="Manage support tickets for HR, Recruitment, and Diplomacy"
          />
          <Stack spacing={1}>
            <Button variant="outlined" onClick={() => refetch()}>
              <Refresh />
              <Typography>Refresh</Typography>
            </Button>
            <Button variant="contained" onClick={() => setShowCreateDialog(true)}>
              <Add />
              <Typography>New Ticket</Typography>
            </Button>
          </Stack>
        </Stack>

        {error && <ErrorMessage message={error} />}

        {/* Search and Filters */}
        <Stack spacing={2} alignItems="end">
          <TextField
            label="Search tickets"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') refetch();
            }}
            sx={{ width: 300 }}
            size="small"
          />
        </Stack>

        {/* Tabs for different views */}
        <Tabs
          aria-label="Ticket status tabs"
          value={selectedTab}
          onChange={(_: React.SyntheticEvent, val: string) => setSelectedTab(val)}
        >
          <Tab label="Open" value="open" />
          <Tab label="In Progress" value="in_progress" />
          <Tab label="Resolved" value="resolved" />
          <Tab label="Closed" value="closed" />
          <Tab label="All" value="all" />
        </Tabs>

        <Stack direction="row" spacing={3} mt={3} height="70vh">
          {/* Ticket List */}
          <Box width="40%" sx={{ overflowY: 'auto' }}>
            <Stack direction="column" spacing={1}>
              {tickets.length === 0 ? (
                <Box sx={{ borderRadius: 1, p: 2 }}>
                  <Typography sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    No tickets found
                  </Typography>
                </Box>
              ) : (
                tickets.map(ticket => (
                  <Box
                    component="button"
                    type="button"
                    key={ticket.id}
                    tabIndex={0}
                    onClick={() => setSelectedTicket(ticket)}
                    sx={{
                      padding: '12px 16px',
                      background:
                        selectedTicket?.id === ticket.id
                          ? alpha(theme.palette.primary.main, 0.15)
                          : alpha(theme.palette.common.white, 0.05),
                      borderRadius: 2,
                      border:
                        selectedTicket?.id === ticket.id
                          ? `1px solid ${alpha(theme.palette.primary.main, 0.5)}`
                          : `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
                      cursor: 'pointer',
                      transition: theme.transitions.create('all', { duration: 200 }),
                      width: '100%',
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                    }}
                  >
                    <Stack direction="column" spacing={0.5}>
                      <Stack justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontWeight: 600, color: 'common.white' }}>
                          {CATEGORY_CONFIG[ticket.category]?.icon} {ticket.ticketNumber}
                        </Typography>
                        <Chip
                          label={STATUS_CONFIG[ticket.status]?.label}
                          size="small"
                          sx={getStatusChipSx(ticket.status, theme)}
                        />
                      </Stack>
                      <Typography sx={{ color: 'primary.main', fontSize: '0.9rem' }}>
                        {ticket.subject}
                      </Typography>
                      <Stack spacing={1} alignItems="center">
                        <Chip
                          label={PRIORITY_CONFIG[ticket.priority]?.label}
                          size="small"
                          color={getPriorityChipColor(ticket.priority)}
                        />
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {formatDate(ticket.createdAt)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                ))
              )}
            </Stack>
          </Box>

          {/* Ticket Details */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {selectedTicket ? (
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  {/* Ticket Header */}
                  <Stack justifyContent="space-between" alignItems="start">
                    <div>
                      <Typography variant="h6" sx={{ color: 'primary.main' }}>
                        {CATEGORY_CONFIG[selectedTicket.category]?.icon} {selectedTicket.subject}
                      </Typography>
                      <Typography sx={{ color: 'text.secondary' }}>
                        {selectedTicket.ticketNumber}
                      </Typography>
                    </div>
                    <Stack spacing={1}>
                      {selectedTicket.status !== TicketStatus.CLOSED && (
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<Close />}
                          onClick={() => setShowCloseConfirm(true)}
                        >
                          Close
                        </Button>
                      )}
                    </Stack>
                  </Stack>

                  {/* Ticket Info */}
                  <Stack spacing={2} flexWrap="wrap">
                    <Stack spacing={0.5} alignItems="center">
                      <Person fontSize="small" />
                      <Typography>{selectedTicket.creatorName}</Typography>
                    </Stack>
                    <Stack spacing={0.5} alignItems="center">
                      <AccessTime fontSize="small" />
                      <Typography>{formatDate(selectedTicket.createdAt)}</Typography>
                    </Stack>
                    <Chip
                      label={STATUS_CONFIG[selectedTicket.status]?.label}
                      size="small"
                      sx={getStatusChipSx(selectedTicket.status, theme)}
                    />
                    <Chip
                      label={`${PRIORITY_CONFIG[selectedTicket.priority]?.label} Priority`}
                      size="small"
                      color={getPriorityChipColor(selectedTicket.priority)}
                    />
                  </Stack>

                  {/* Recipient routing info */}
                  {selectedTicket.recipientType &&
                    RECIPIENT_TYPE_CONFIG[selectedTicket.recipientType] && (
                      <Stack spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Routed to:
                        </Typography>
                        <Chip
                          label={
                            <>
                              {RECIPIENT_TYPE_CONFIG[selectedTicket.recipientType].icon}{' '}
                              {RECIPIENT_TYPE_CONFIG[selectedTicket.recipientType].label}
                            </>
                          }
                          size="small"
                          variant="outlined"
                        />
                        {selectedTicket.recipientName && (
                          <Chip
                            label={selectedTicket.recipientName}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    )}

                  <Divider />

                  {/* Description */}
                  <div>
                    <Typography variant="subtitle1">Description</Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedTicket.description}
                    </Typography>
                  </div>

                  {selectedTicket.resolution && (
                    <>
                      <Divider />
                      <div>
                        <Typography variant="subtitle1">Resolution</Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                          {selectedTicket.resolution}
                        </Typography>
                      </div>
                    </>
                  )}

                  <Divider />

                  {/* Messages */}
                  <div>
                    <Typography variant="subtitle1">
                      <ChatBubble fontSize="small" /> Messages (
                      {selectedTicket.messages?.length || 0})
                    </Typography>
                    <Stack direction="column" spacing={1.5} mt={1}>
                      {selectedTicket.messages?.map(msg => (
                        <Box
                          key={msg.id}
                          sx={{
                            padding: '12px',
                            background: msg.isInternal
                              ? alpha(theme.palette.warning.main, 0.1)
                              : alpha(theme.palette.primary.main, 0.1),
                            borderRadius: 2,
                            borderLeft: `3px solid ${msg.isInternal ? theme.palette.warning.main : theme.palette.primary.main}`,
                          }}
                        >
                          <Stack justifyContent="space-between" mb={0.5}>
                            <Typography sx={{ fontWeight: 600 }}>
                              {msg.authorName}
                              {msg.isInternal && (
                                <Chip
                                  label="Internal"
                                  color="warning"
                                  size="small"
                                  sx={{ marginLeft: 1 }}
                                />
                              )}
                            </Typography>
                            <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                              {formatDate(msg.createdAt)}
                            </Typography>
                          </Stack>
                          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </div>

                  {/* Reply Form */}
                  {selectedTicket.status !== TicketStatus.CLOSED && (
                    <>
                      <Divider />
                      <div>
                        <Typography variant="subtitle1">Add Reply</Typography>
                        <Stack direction="column" spacing={1} mt={1}>
                          <TypographyArea
                            label="Message"
                            value={replyContent}
                            onChange={setReplyContent}
                            width="100%"
                          />
                          <Stack justifyContent="space-between" alignItems="center">
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={isInternalNote}
                                  onChange={(_, checked) => setIsInternalNote(checked)}
                                />
                              }
                              label="Internal note (staff only)"
                            />
                            <Button
                              variant="contained"
                              onClick={handleAddReply}
                              disabled={!replyContent.trim()}
                            >
                              Send Reply
                            </Button>
                          </Stack>
                        </Stack>
                      </div>
                    </>
                  )}
                </Stack>
              </Box>
            ) : (
              <Box
                sx={{
                  borderRadius: 1,
                  p: 2,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ color: 'text.secondary' }}>
                  Select a ticket to view details
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>

        {/* Create Ticket Dialog */}
        <Dialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogContent>
            <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
              <Stack direction="row" spacing={2}>
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={newTicket.category}
                    onChange={e =>
                      setNewTicket({ ...newTicket, category: e.target.value as TicketCategory })
                    }
                    label="Category"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, { icon, label }]) => (
                      <MenuItem key={key} value={key}>
                        {icon} {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={newTicket.priority}
                    onChange={e =>
                      setNewTicket({ ...newTicket, priority: e.target.value as TicketPriority })
                    }
                    label="Priority"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([key, { label }]) => (
                      <MenuItem key={key} value={key}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl sx={{ flex: 1 }} required>
                  <InputLabel>Send To</InputLabel>
                  <Select
                    value={newTicket.recipientType}
                    onChange={e =>
                      setNewTicket({
                        ...newTicket,
                        recipientType: e.target.value as TicketRecipientType,
                      })
                    }
                    label="Send To"
                  >
                    {(['role', 'function', 'direct'] as const).flatMap(group => [
                      <ListSubheader key={`group-${group}`}>{GROUP_LABELS[group]}</ListSubheader>,
                      ...Object.entries(RECIPIENT_TYPE_CONFIG)
                        .filter(([, info]) => info.group === group)
                        .map(([key, { icon, label, description }]) => (
                          <MenuItem key={key} value={key}>
                            <Stack>
                              <Typography variant="body2">
                                {icon} {label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {description}
                              </Typography>
                            </Stack>
                          </MenuItem>
                        )),
                    ])}
                  </Select>
                </FormControl>
              </Stack>
              <TextField
                label="Subject"
                value={newTicket.subject}
                onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                required
                fullWidth
                slotProps={{ htmlInput: { maxLength: 200 } }}
                error={newTicket.subject.length > 0 && newTicket.subject.length < 3}
                helperText={
                  newTicket.subject.length > 0 && newTicket.subject.length < 3
                    ? 'Subject must be at least 3 characters'
                    : undefined
                }
              />
              <TextField
                label="Description"
                value={newTicket.description}
                onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
                required
                multiline
                rows={4}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 5000 } }}
                error={newTicket.description.length > 0 && newTicket.description.length < 10}
                helperText={
                  newTicket.description.length > 0 && newTicket.description.length < 10
                    ? 'Description must be at least 10 characters'
                    : undefined
                }
              />
              {/* User picker — shown only when "Specific User" is selected */}
              {newTicket.recipientType === TicketRecipientType.SPECIFIC_USER && (
                <Autocomplete
                  options={orgMembers}
                  loading={membersLoading}
                  value={selectedRecipient}
                  onChange={(_, value) => setSelectedRecipient(value)}
                  getOptionLabel={option => option.displayName || option.username || option.userId}
                  isOptionEqualToValue={(a, b) => a.userId === b.userId}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="Select Member"
                      required
                      placeholder="Search by name..."
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.userId}>
                      <Stack>
                        <Typography variant="body2">
                          {option.displayName || option.username || option.userId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.role}
                        </Typography>
                      </Stack>
                    </li>
                  )}
                  fullWidth
                />
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateTicket}
              disabled={
                !newTicket.subject ||
                newTicket.subject.length < 3 ||
                !newTicket.description ||
                newTicket.description.length < 10 ||
                !newTicket.recipientType ||
                (newTicket.recipientType === TicketRecipientType.SPECIFIC_USER &&
                  !selectedRecipient)
              }
            >
              Create Ticket
            </Button>
          </DialogActions>
        </Dialog>

        {/* Close Ticket Confirmation Dialog */}
        <Dialog open={showCloseConfirm} onClose={() => setShowCloseConfirm(false)} maxWidth="sm">
          <DialogTitle>Close Ticket</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to close this ticket?</Typography>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setShowCloseConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                if (selectedTicket) {
                  handleCloseTicket(selectedTicket.id);
                }
                setShowCloseConfirm(false);
              }}
            >
              Close Ticket
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  );
};
