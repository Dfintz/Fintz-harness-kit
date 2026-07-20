import { logger } from '@/utils/logger';
import CheckmarkIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EmailIcon from '@mui/icons-material/Email';
import InboxIcon from '@mui/icons-material/Inbox';
import LoginIcon from '@mui/icons-material/Login';
import SendIcon from '@mui/icons-material/Send';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';

import {
  contactRequestService,
  ContactTargetType,
  ContactType,
  getContactTypeLabel,
  MessageVisibility,
  SubmitContactRequestInput,
} from '@/services/publicDirectoryService';
import { selectIsAuthenticated, selectUser, useAuthStore } from '@/store';

export interface ContactFormModalProps {
  /** Target type - organization or alliance */
  targetType: ContactTargetType;
  /** Organization ID (if targeting an organization) */
  organizationId?: string;
  /** Alliance ID (if targeting an alliance) */
  allianceId?: string;
  /** Target name for display */
  targetName: string;
  /** Whether to show compact trigger button */
  compact?: boolean;
  /** Callback when contact request is submitted successfully */
  onSuccess?: () => void;
  /** External control for dialog open state (optional) */
  open?: boolean;
  /** Callback when dialog should close (optional, used with external control) */
  onClose?: () => void;
  /** Callback when dialog should open (optional, used with external control) */
  onOpen?: () => void;
  /** Hide trigger button when using external control */
  hideTrigger?: boolean;
  /** Default contact type to pre-select when opening */
  defaultContactType?: ContactType;
}

/**
 * ContactFormModal - Modal dialog for submitting contact requests
 *
 * Internal messaging system for organizations and alliances.
 * Requires authentication. Auto-populates sender info from user profile.
 * Messages appear in the user's inbox for threaded replies.
 */
export const ContactFormModal: React.FC<ContactFormModalProps> = ({
  targetType,
  organizationId,
  allianceId,
  targetName,
  compact: _compact = false,
  onSuccess,
  open: externalOpen,
  onClose: externalOnClose,
  onOpen: externalOnOpen,
  hideTrigger = false,
  defaultContactType = 'general',
}) => {
  const user = useAuthStore(selectUser);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  // Form state - use external control if provided, otherwise internal
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalOpen(false);
    }
  };
  const handleOpen = () => {
    if (externalOnOpen) {
      externalOnOpen();
    } else if (externalOpen === undefined) {
      setInternalOpen(true);
    }
    // If externally controlled but no onOpen callback, do nothing (expected to be opened elsewhere)
  };
  const [senderName, setSenderName] = useState('');
  const [rsiHandle, setRsiHandle] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactType, setContactType] = useState<ContactType>(defaultContactType);
  const [visibility, setVisibility] = useState<MessageVisibility>(MessageVisibility.ALL);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Contact type options
  const contactTypes: ContactType[] = [
    'general',
    'recruitment',
    'partnership',
    'question',
    'feedback',
    'other',
  ];

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setSenderName('');
        setRsiHandle('');
        setDiscordUsername('');
        setSubject('');
        setMessage('');
        setContactType(defaultContactType);
        setVisibility(MessageVisibility.ALL);
        setError(null);
        setSuccess(false);
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  // Auto-populate from user profile when opening
  useEffect(() => {
    if (isOpen && user) {
      setSenderName(user.username || '');
      setRsiHandle(user.rsiHandle || '');
      setDiscordUsername(user.discordUsername || '');
    }
  }, [isOpen, user]);

  const _handleOpen = () => {
    setError(null);
    setSuccess(false);
    handleOpen();
  };

  const _handleClose = () => {
    if (!isSubmitting) {
      handleClose();
    }
  };

  const isFormValid = (): boolean => {
    return (
      senderName.trim().length >= 1 && subject.trim().length >= 1 && message.trim().length >= 10
    );
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      setError('Please fill in all required fields correctly.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: SubmitContactRequestInput = {
        targetType,
        organizationId: targetType === 'organization' ? organizationId : undefined,
        allianceId: targetType === 'alliance' ? allianceId : undefined,
        senderName: senderName.trim(),
        rsiHandle: rsiHandle.trim() || undefined,
        discordUsername: discordUsername.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
        contactType,
        visibility,
      };

      await contactRequestService.submitContactRequest(input);
      setSuccess(true);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      logger.error(
        'Error submitting contact request:',
        err,
        new Error('Error submitting contact request:', { cause: err })
      );
      // Extract server error message if available
      const serverMessage = (err as { response?: { data?: { error?: string } } })?.response?.data
        ?.error;
      let errorMessage = 'Failed to send message. Please try again later.';
      if (serverMessage) {
        const normalizedMessage = serverMessage.toLowerCase();
        if (
          normalizedMessage.includes('not accepting') ||
          normalizedMessage.includes('not found')
        ) {
          errorMessage =
            'This organization is not currently accepting public messages. They may not have enabled their public profile.';
        }
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state content
  if (success) {
    return (
      <>
        {!hideTrigger && (
          <IconButton onClick={_handleOpen} aria-label="Contact">
            <EmailIcon />
          </IconButton>
        )}
        <Dialog open={isOpen} onClose={_handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>Message Sent!</DialogTitle>
          <Divider />
          <DialogContent>
            <Stack direction="column" alignItems="center" spacing={3} sx={{ py: 2 }}>
              <Box sx={{ p: 3, borderRadius: '50%', bgcolor: 'success.main' }}>
                <CheckmarkIcon sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Typography align="center">
                Your message has been sent to <strong>{targetName}</strong>. You can check for
                replies in your inbox.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={_handleClose} startIcon={<CloseIcon />}>
              Close
            </Button>
            <Button variant="contained" href="/inbox" startIcon={<InboxIcon />}>
              Go to Inbox
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {!hideTrigger && (
        <IconButton onClick={_handleOpen} aria-label="Contact">
          <EmailIcon />
        </IconButton>
      )}
      <Dialog open={isOpen} onClose={_handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Contact {targetName}</DialogTitle>
        <Divider />
        <DialogContent>
          {isAuthenticated ? (
            <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
              {/* Error display */}
              {error && (
                <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'error.dark' }}>
                  <Typography color="error.contrastText">{error}</Typography>
                </Box>
              )}

              {/* Contact type */}
              <FormControl fullWidth disabled={isSubmitting}>
                <InputLabel>Reason for contact</InputLabel>
                <Select
                  value={contactType}
                  label="Reason for contact"
                  onChange={e => setContactType(e.target.value as ContactType)}
                >
                  {contactTypes.map(type => (
                    <MenuItem key={type} value={type}>
                      {getContactTypeLabel(type)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Visibility — who in the org can read this message */}
              <FormControl fullWidth disabled={isSubmitting}>
                <InputLabel>Visible to</InputLabel>
                <Select
                  value={visibility}
                  label="Visible to"
                  onChange={e => setVisibility(e.target.value as MessageVisibility)}
                >
                  <MenuItem value={MessageVisibility.ALL}>Everyone in the org</MenuItem>
                  <MenuItem value={MessageVisibility.LEADERSHIP}>
                    Leadership only (owner / admin / officer)
                  </MenuItem>
                  <MenuItem value={MessageVisibility.HR}>HR Division</MenuItem>
                  <MenuItem value={MessageVisibility.DIPLOMACY}>Diplomacy Division</MenuItem>
                  <MenuItem value={MessageVisibility.RECRUITMENT}>Recruitment Division</MenuItem>
                </Select>
              </FormControl>

              {/* Sender information */}
              <TextField
                label="Your Name"
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                required
                disabled={isSubmitting}
                slotProps={{ htmlInput: { maxLength: 100 } }}
                fullWidth
              />

              {/* Optional contact info */}
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: '200px' }}>
                  <TextField
                    label="RSI Handle (optional)"
                    value={rsiHandle}
                    onChange={e => setRsiHandle(e.target.value)}
                    disabled={isSubmitting}
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                    fullWidth
                    helperText="Your in-game handle"
                  />
                </Box>
                <Box sx={{ flex: 1, minWidth: '200px' }}>
                  <TextField
                    label="Discord Username (optional)"
                    value={discordUsername}
                    onChange={e => setDiscordUsername(e.target.value)}
                    disabled={isSubmitting}
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                    fullWidth
                    helperText="e.g., username#1234"
                  />
                </Box>
              </Stack>

              {/* Subject */}
              <TextField
                label="Subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                disabled={isSubmitting}
                slotProps={{ htmlInput: { maxLength: 255 } }}
                fullWidth
              />

              {/* Message */}
              <TextField
                label="Message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                disabled={isSubmitting}
                slotProps={{ htmlInput: { maxLength: 5000 } }}
                fullWidth
                multiline
                rows={6}
                error={message.length > 0 && message.length < 10}
                helperText={`${message.length}/5000 characters (minimum 10)`}
              />

              {/* Privacy note */}
              <Typography variant="caption" color="text.secondary">
                Your message will be delivered to {targetName}&apos;s inbox. Replies will appear in
                your inbox. Your username and optional contact details will be shared.
              </Typography>
            </Stack>
          ) : (
            <Stack direction="column" alignItems="center" spacing={3} sx={{ py: 4 }}>
              <LoginIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography align="center" variant="h6">
                Sign in to send messages
              </Typography>
              <Typography align="center" color="text.secondary">
                You need to be logged in to contact {targetName}. Sign in to send messages and track
                replies in your inbox.
              </Typography>
              <Button variant="contained" href="/login" startIcon={<LoginIcon />}>
                Sign In
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={_handleClose}
            disabled={isSubmitting}
            startIcon={<CloseIcon />}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!isFormValid() || isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
