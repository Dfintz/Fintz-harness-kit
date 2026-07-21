import { MyInvitationsPanel } from '@/components/organization/MyInvitationsPanel';
import { TicketManagement } from '@/components/TicketManagement';
import { TicketCategory } from '@/services/ticketService';
import {
    useAddInboxReply,
    useInboxMessageDetail,
    useInboxMessages,
} from '@/hooks/queries/useInboxQueries';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import InboxIcon from '@mui/icons-material/Inbox';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ReplyIcon from '@mui/icons-material/Reply';
import SendIcon from '@mui/icons-material/Send';
import {
    Alert,
    Avatar,
    Badge,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Paper,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
    type ContactRequestReplyItem,
    getContactStatusLabel,
    getContactTypeIcon,
    getContactTypeLabel,
} from '@/services/publicDirectoryService';
import { getStatusChipSx } from '@/utils/statusStyles';
import { useTheme } from '@mui/material/styles';

/** Tab index mapping for URL query param */
const TAB_KEYS = ['messages', 'invitations', 'tickets'] as const;
type TabKey = (typeof TAB_KEYS)[number];

function tabKeyToIndex(key: string | null): number {
  const idx = TAB_KEYS.indexOf(key as TabKey);
  return Math.max(0, idx);
}

function parseTicketCategory(value: string | null): TicketCategory | undefined {
  if (!value) return undefined;
  const values = Object.values(TicketCategory);
  return values.includes(value as TicketCategory) ? (value as TicketCategory) : undefined;
}

/**
 * InboxPage - Unified communication hub
 *
 * Consolidates all user-facing communication into a single page:
 *   • Messages — sent contact requests and reply threads
 *   • Invitations — received organization invitations (accept/decline)
 *   • Tickets — support tickets for HR, Recruitment, Diplomacy
 */
export const InboxPage: React.FC = () => {
  const theme = useTheme();
  const { requestId } = useParams<{ requestId?: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tab state — "messages", "invitations", or "tickets"
  const isTicketsPath = location.pathname === '/tickets' || location.pathname.startsWith('/tickets/');
  const ticketCategoryFilter = parseTicketCategory(searchParams.get('category'));
  const activeTab = isTicketsPath && !searchParams.get('tab') ? 2 : tabKeyToIndex(searchParams.get('tab'));
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const key = TAB_KEYS[newValue];
    if (key === 'messages') {
      setSearchParams({});
      return;
    }

    const next: Record<string, string> = { tab: key };
    if (key === 'tickets' && ticketCategoryFilter) {
      next.category = ticketCategoryFilter;
    }
    setSearchParams(next);
  };

  // Server state via React Query
  const { data: messages = [], isLoading } = useInboxMessages();
  const { data: selectedMessage, isLoading: isLoadingDetail } = useInboxMessageDetail(requestId);
  const addReplyMutation = useAddInboxReply();
  const notification = useNotification();

  // Reply state
  const [replyText, setReplyText] = useState('');

  const handleSelectMessage = (id: string) => {
    navigate(`/inbox/${id}`);
  };

  const handleBack = () => {
    navigate('/inbox');
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    try {
      await addReplyMutation.mutateAsync({
        requestId: selectedMessage.id,
        message: replyText.trim(),
      });
      setReplyText('');
    } catch (err) {
      logger.error('Failed to send reply:', err instanceof Error ? err : new Error(String(err)));
      notification.error('Failed to send reply. Please try again.');
    }
  };

  const renderMessageDetailContent = () => {
    if (isLoadingDetail) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (!selectedMessage) {
      return <Alert severity="error">Message not found</Alert>;
    }

    return (
      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h6">{selectedMessage.subject}</Typography>
                <Typography variant="body2" color="text.secondary">
                  From: {selectedMessage.senderName || 'Unknown sender'}
                  {selectedMessage.rsiHandle && ` (RSI: ${selectedMessage.rsiHandle})`}
                  {selectedMessage.discordUsername &&
                    ` · Discord: ${selectedMessage.discordUsername}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  To:{' '}
                  {selectedMessage.organizationName || selectedMessage.allianceName || 'Unknown'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(selectedMessage.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={getContactTypeLabel(selectedMessage.contactType)}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={getContactStatusLabel(selectedMessage.status)}
                  size="small"
                  sx={getStatusChipSx(selectedMessage.status, theme)}
                />
              </Stack>
            </Stack>
            <Divider />
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {selectedMessage.message}
            </Typography>
          </Stack>
        </Paper>

        {selectedMessage.replies && selectedMessage.replies.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Replies ({selectedMessage.replies.length})
            </Typography>
            <Stack spacing={2}>
              {selectedMessage.replies.map((reply: ContactRequestReplyItem) => (
                <Paper
                  key={reply.id}
                  sx={{
                    p: 2,
                    ml: reply.isOrgReply ? 0 : 4,
                    mr: reply.isOrgReply ? 4 : 0,
                    bgcolor: reply.isOrgReply ? 'action.hover' : 'background.paper',
                    borderLeft: reply.isOrgReply ? '3px solid' : 'none',
                    borderRight: reply.isOrgReply ? 'none' : '3px solid',
                    borderColor: reply.isOrgReply ? 'primary.main' : 'secondary.main',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Avatar
                      src={sanitizeImageUrl(reply.senderAvatar) || undefined}
                      sx={{ width: 24, height: 24, fontSize: 12 }}
                    >
                      {(reply.senderUsername || '?')[0].toUpperCase()}
                    </Avatar>
                    <Typography variant="subtitle2">
                      {reply.senderUsername || 'Unknown'}
                      {reply.isOrgReply && (
                        <Chip label="Org" size="small" color="primary" sx={{ ml: 1, height: 20 }} />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(reply.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {reply.message}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            <ReplyIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom', mr: 0.5 }} />
            Reply
          </Typography>
          <Stack spacing={2}>
            <TextField
              placeholder="Type your reply..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              multiline
              rows={3}
              fullWidth
              disabled={addReplyMutation.isPending}
              slotProps={{ htmlInput: { maxLength: 5000 } }}
              helperText={`${replyText.length}/5000`}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleSendReply}
                disabled={!replyText.trim() || addReplyMutation.isPending}
                startIcon={
                  addReplyMutation.isPending ? <CircularProgress size={16} /> : <SendIcon />
                }
              >
                {addReplyMutation.isPending ? 'Sending...' : 'Send Reply'}
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    );
  };

  const renderMessagesTab = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (messages.length === 0) {
      return (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <MailOutlineIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No messages yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            When you contact an organization or alliance, your messages will appear here.
            You&apos;ll be notified when they reply.
          </Typography>
        </Paper>
      );
    }

    return (
      <Stack spacing={1}>
        {messages.map(msg => (
          <Card
            key={msg.id}
            variant="outlined"
            sx={{
              borderColor: msg.status === 'replied' ? 'primary.main' : 'divider',
            }}
          >
            <CardActionArea onClick={() => handleSelectMessage(msg.id)}>
              <CardContent sx={{ py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    <Typography sx={{ fontSize: 20 }}>
                      {getContactTypeIcon(msg.contactType)}
                    </Typography>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {msg.subject}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        To: {msg.organizationName || msg.allianceName || 'Unknown'} &middot;{' '}
                        {getContactTypeLabel(msg.contactType)} &middot;{' '}
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {(msg.replyCount ?? 0) > 0 && (
                      <Chip
                        icon={<ReplyIcon />}
                        label={msg.replyCount}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    <Chip
                      label={getContactStatusLabel(msg.status)}
                      size="small"
                      sx={getStatusChipSx(msg.status, theme)}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    );
  };

  // Message detail view
  if (selectedMessage || (requestId && isLoadingDetail)) {
    return (
      <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <IconButton onClick={handleBack} aria-label="Back to inbox">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1">
            Message Detail
          </Typography>
        </Stack>

        {renderMessageDetailContent()}
      </Box>
    );
  }

  // Message list view
  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <InboxIcon sx={{ fontSize: 28 }} />
        <Typography variant="h5" component="h1">
          Inbox
        </Typography>
      </Stack>

      {/* Tabs: Messages | Invitations | Tickets */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab
          icon={<MailOutlineIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={
            <Badge
              badgeContent={messages.filter(m => m.status === 'replied').length}
              color="primary"
              sx={{ '& .MuiBadge-badge': { right: -12, top: 2 } }}
            >
              Messages
            </Badge>
          }
          sx={{ textTransform: 'none', minHeight: 48, mr: 1 }}
        />
        <Tab
          icon={<PersonAddIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Invitations"
          sx={{ textTransform: 'none', minHeight: 48, mr: 1 }}
        />
        <Tab
          icon={<ConfirmationNumberIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Tickets"
          sx={{ textTransform: 'none', minHeight: 48 }}
        />
      </Tabs>

      {/* Messages tab */}
      {activeTab === 0 && renderMessagesTab()}

      {/* Invitations tab */}
      {activeTab === 1 && <MyInvitationsPanel />}

      {/* Tickets tab — reuses TicketManagement (HR, Recruitment, Diplomacy) */}
      {activeTab === 2 && <TicketManagement categoryFilter={ticketCategoryFilter} />}
    </Box>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const InboxPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Inbox">
    <InboxPage />
  </FeatureErrorBoundary>
);
