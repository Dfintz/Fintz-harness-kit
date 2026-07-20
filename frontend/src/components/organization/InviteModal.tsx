import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { searchGlobal, type GlobalSearchResult } from '@/services/globalSearchService';
import { invitationService } from '@/services/invitationService';

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  onSuccess?: () => void;
}

/**
 * InviteModal — MUI Dialog for sending an invitation to join an organization.
 *
 * Officers/admins: invitations are auto-approved (invitee can accept immediately).
 * Members: invitations require admin approval before the invitee is notified.
 */
export const InviteModal: React.FC<InviteModalProps> = ({
  open,
  onClose,
  organizationId,
  organizationName,
  onSuccess,
}) => {
  const theme = useTheme();
  const [selectedUser, setSelectedUser] = useState<GlobalSearchResult | null>(null);
  const [userSearchOptions, setUserSearchOptions] = useState<GlobalSearchResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const MAX_MESSAGE_LENGTH = 500;

  // Clean up debounce timer and abort controller on unmount
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSearchUsers = useCallback((query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    abortControllerRef.current?.abort();
    if (!query || query.length < 2) {
      setUserSearchOptions([]);
      setUserSearchLoading(false);
      return;
    }
    setUserSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        const results = await searchGlobal(query, ['user'], 10);
        if (!controller.signal.aborted) {
          setUserSearchOptions(results);
        }
      } catch {
        if (!controller.signal.aborted) {
          setUserSearchOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setUserSearchLoading(false);
        }
      }
    }, 300);
  }, []);

  const handleSubmit = async () => {
    if (!selectedUser) {
      setError('Please select a user to invite.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await invitationService.sendInvitation(organizationId, selectedUser.id, message || undefined);
      setSubmitted(true);
      onSuccess?.();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send invitation. Please try again.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedUser(null);
    setUserSearchOptions([]);
    setMessage('');
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: theme.palette.background.paper,
            color: theme.palette.common.white,
            borderRadius: 2,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          {submitted ? 'Invitation Sent' : `Invite to ${organizationName}`}
        </Typography>
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{ color: theme.palette.text.secondary }}
          aria-label="Close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {submitted ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: theme.palette.success.dark, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Invitation Sent!
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              The invitation to join <strong>{organizationName}</strong> has been sent. The user
              will be able to accept or decline it.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
              Send an invitation to a user to join <strong>{organizationName}</strong>.
            </Typography>

            <Autocomplete
              options={userSearchOptions}
              value={selectedUser}
              getOptionLabel={option => option.title}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={x => x}
              loading={userSearchLoading}
              onInputChange={(_event, value, reason) => {
                if (reason === 'input') {
                  setUserSearchOptions([]);
                  handleSearchUsers(value);
                }
              }}
              onChange={(_event, newValue) => {
                setSelectedUser(newValue);
                setError(null);
              }}
              disabled={submitting}
              noOptionsText="Type at least 2 characters to search"
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{option.title}</Typography>
                    {option.subtitle && (
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        {option.subtitle}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Search User"
                  placeholder="Search by username or display name..."
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {userSearchLoading ? <CircularProgress size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: theme.palette.common.white,
                      '& fieldset': { borderColor: alpha(theme.palette.common.white, 0.12) },
                      '&:hover fieldset': { borderColor: theme.palette.info.light },
                      '&.Mui-focused fieldset': { borderColor: theme.palette.info.light },
                    },
                    '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                  }}
                />
              )}
              sx={{ mb: 2 }}
            />

            <TextField
              label="Message (optional)"
              multiline
              rows={3}
              fullWidth
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              placeholder="Add a personal message to the invitation..."
              helperText={`${message.length}/${MAX_MESSAGE_LENGTH} characters`}
              disabled={submitting}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: theme.palette.common.white,
                  '& fieldset': { borderColor: alpha(theme.palette.common.white, 0.12) },
                  '&:hover fieldset': { borderColor: theme.palette.info.light },
                  '&.Mui-focused fieldset': { borderColor: theme.palette.info.light },
                },
                '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                '& .MuiFormHelperText-root': { color: theme.palette.text.secondary },
              }}
            />

            {error && (
              <Typography variant="body2" sx={{ color: theme.palette.error.light, mt: 1 }}>
                {error}
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{ px: 3, pb: 2, borderTop: `1px solid ${alpha(theme.palette.common.white, 0.12)}` }}
      >
        {submitted ? (
          <Button onClick={handleClose} sx={{ color: theme.palette.common.white }}>
            Close
          </Button>
        ) : (
          <>
            <Button
              onClick={handleClose}
              sx={{ color: theme.palette.text.secondary }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !selectedUser}
              sx={{
                bgcolor: theme.palette.success.dark,
                '&:hover': { bgcolor: theme.palette.success.main },
                '&.Mui-disabled': {
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  color: theme.palette.text.disabled,
                },
              }}
            >
              {submitting ? (
                <CircularProgress size={20} sx={{ color: theme.palette.common.white }} />
              ) : (
                'Send Invitation'
              )}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
