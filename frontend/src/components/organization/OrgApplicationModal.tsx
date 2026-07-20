import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, type Theme, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';

import { SignInGate } from '@/components/SignInGate';
import { useApplicationMode, useSubmitApplication } from '@/hooks/queries/useApplicationQueries';
import { logger } from '@/utils/logger';

import type { ApplicationQuestion } from '@sc-fleet-manager/shared-types';

// ── Extracted sub-component to reduce parent cognitive complexity ────

interface QuestionFieldProps {
  question: ApplicationQuestion;
  value: string;
  onChange: (questionId: string, value: string) => void;
  disabled: boolean;
  theme: Theme;
}

const FIELD_SX = (theme: Theme) => ({
  '& .MuiOutlinedInput-root': {
    color: theme.palette.common.white,
    '& fieldset': { borderColor: alpha(theme.palette.common.white, 0.12) },
    '&:hover fieldset': { borderColor: theme.palette.info.light },
    '&.Mui-focused fieldset': { borderColor: theme.palette.info.light },
  },
  '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
  '& .MuiFormHelperText-root': { color: theme.palette.text.secondary },
});

const RequiredMarker: React.FC<Readonly<{ show: boolean; theme: Theme }>> = ({ show, theme }) =>
  show ? (
    <Typography component="span" sx={{ color: theme.palette.error.main }}>
      {' *'}
    </Typography>
  ) : null;

const QuestionField: React.FC<Readonly<QuestionFieldProps>> = ({
  question,
  value,
  onChange,
  disabled,
  theme,
}) => {
  const fieldSx = FIELD_SX(theme);

  if (question.type === 'short' || question.type === 'paragraph') {
    return (
      <TextField
        label={question.label}
        required={question.required}
        value={value}
        onChange={e =>
          onChange(
            question.id,
            e.target.value.slice(0, question.maxLength ?? (question.type === 'short' ? 500 : 2000))
          )
        }
        placeholder={question.placeholder}
        fullWidth
        size="small"
        multiline={question.type === 'paragraph'}
        rows={question.type === 'paragraph' ? 3 : undefined}
        disabled={disabled}
        helperText={question.maxLength ? `${value.length}/${question.maxLength}` : undefined}
        sx={fieldSx}
      />
    );
  }

  if (question.type === 'select') {
    return (
      <FormControl fullWidth size="small" required={question.required}>
        <InputLabel sx={{ color: theme.palette.text.secondary }}>{question.label}</InputLabel>
        <Select
          value={value}
          label={question.label}
          onChange={e => onChange(question.id, e.target.value)}
          disabled={disabled}
          sx={{
            color: theme.palette.common.white,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(theme.palette.common.white, 0.12),
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.info.light,
            },
          }}
        >
          {(question.options ?? []).map(option => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (question.type === 'checkbox' || question.type === 'rules') {
    const isRules = question.type === 'rules';
    const checked = isRules ? value === 'accepted' : value === 'true';
    const onCheck = (_e: React.SyntheticEvent, chk: boolean) => {
      if (isRules) {
        onChange(question.id, chk ? 'accepted' : '');
      } else {
        onChange(question.id, chk ? 'true' : 'false');
      }
    };

    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={onCheck}
            disabled={disabled}
            sx={{ color: theme.palette.text.secondary }}
          />
        }
        label={
          <Typography variant="body2">
            {question.label}
            <RequiredMarker show={question.required} theme={theme} />
          </Typography>
        }
      />
    );
  }

  return null;
};

// ── Main Modal ──────────────────────────────────────────────────────

interface OrgApplicationModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  onSuccess?: () => void;
}

/**
 * Adaptive OrgApplicationModal — renders different UI based on the org's application mode:
 *   - simple: message-only textarea (original behavior)
 *   - custom: multi-field form based on org-defined questions
 *   - discord: redirect to Discord server
 */
export const OrgApplicationModal: React.FC<OrgApplicationModalProps> = ({
  open,
  onClose,
  organizationId,
  organizationName,
  onSuccess,
}) => {
  const theme = useTheme();
  const [message, setMessage] = useState('');
  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_MESSAGE_LENGTH = 1000;

  const {
    data: modeInfo,
    isPending: modeLoading,
    error: modeError,
  } = useApplicationMode(organizationId, open);
  const submitMutation = useSubmitApplication(organizationId);

  const mode = modeInfo?.mode ?? 'simple';
  const questions = modeInfo?.questions ?? [];

  const handleSubmit = async () => {
    setError(null);
    try {
      await submitMutation.mutateAsync({
        message: message || undefined,
        formResponses: mode === 'custom' ? formResponses : undefined,
        source: 'web',
      });
      setSubmitted(true);
      onSuccess?.();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to submit application. Please try again.';
      setError(errorMessage);
      logger.error(
        'Application submit failed',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleClose = () => {
    setMessage('');
    setFormResponses({});
    setSubmitted(false);
    setError(null);
    onClose();
  };

  const updateFormResponse = (questionId: string, value: string) => {
    setFormResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const renderQuestionField = (question: ApplicationQuestion) => (
    <QuestionField
      key={question.id}
      question={question}
      value={formResponses[question.id] ?? ''}
      onChange={updateFormResponse}
      disabled={submitMutation.isPending}
      theme={theme}
    />
  );

  const isSubmitting = submitMutation.isPending;

  const renderDialogContent = () => {
    if (modeLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (submitted) {
      return (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: theme.palette.success.dark, mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            Application Submitted!
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Your application to join <strong>{organizationName}</strong> has been submitted. You
            will be notified when it is reviewed.
          </Typography>
        </Box>
      );
    }

    if (modeError) {
      return (
        <Alert severity="error">Failed to load application form. Please try again later.</Alert>
      );
    }

    if (mode === 'discord') {
      return (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
            This organization uses Discord for applications
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
            Click the button below to apply via their Discord server. Your application will be
            reviewed by the organization&apos;s admins through Discord.
          </Typography>
          {modeInfo?.discordInviteUrl?.startsWith('https://') ? (
            <Button
              variant="contained"
              startIcon={<OpenInNewIcon />}
              href={modeInfo.discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                bgcolor: theme.palette.secondary.main,
                '&:hover': { bgcolor: theme.palette.secondary.dark },
              }}
            >
              Apply via Discord
            </Button>
          ) : (
            <Alert severity="warning">
              Discord invite link not available. Contact the organization directly.
            </Alert>
          )}
        </Box>
      );
    }

    // Simple or Custom mode
    const fieldSx = FIELD_SX(theme);

    return (
      <>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
          Submit your application to join <strong>{organizationName}</strong>.
        </Typography>

        {mode === 'simple' && (
          <TextField
            label="Message (optional)"
            multiline
            rows={3}
            fullWidth
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder="Tell the organization about yourself and why you'd like to join..."
            helperText={`${message.length}/${MAX_MESSAGE_LENGTH} characters`}
            disabled={isSubmitting}
            sx={fieldSx}
          />
        )}

        {mode === 'custom' && (
          <>
            <TextField
              label="Additional Message (optional)"
              multiline
              rows={2}
              fullWidth
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              placeholder="Tell the organization about yourself and why you'd like to join..."
              helperText={`${message.length}/${MAX_MESSAGE_LENGTH} characters`}
              disabled={isSubmitting}
              sx={{ ...fieldSx, mb: 2 }}
            />

            {questions.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[...questions].sort((a, b) => a.order - b.order).map(renderQuestionField)}
              </Box>
            )}
          </>
        )}

        {error && (
          <Typography variant="body2" sx={{ color: theme.palette.error.light, mt: 1 }}>
            {error}
          </Typography>
        )}
      </>
    );
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
          {submitted ? 'Application Submitted' : `Apply to Join ${organizationName}`}
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
        <SignInGate
          actionLabel="apply"
          description={`You need to be logged in to apply to ${organizationName}. Sign in to submit your application.`}
        >
          {renderDialogContent()}
        </SignInGate>
      </DialogContent>

      <DialogActions
        sx={{ px: 3, pb: 2, borderTop: `1px solid ${alpha(theme.palette.common.white, 0.12)}` }}
      >
        {submitted || mode === 'discord' ? (
          <Button onClick={handleClose} sx={{ color: theme.palette.common.white }}>
            Close
          </Button>
        ) : (
          <>
            <Button
              onClick={handleClose}
              sx={{ color: theme.palette.text.secondary }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={isSubmitting || modeLoading}
              sx={{
                bgcolor: theme.palette.success.dark,
                '&:hover': { bgcolor: theme.palette.success.main },
                '&.Mui-disabled': {
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  color: theme.palette.text.disabled,
                },
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={20} sx={{ color: theme.palette.common.white }} />
              ) : (
                'Submit Application'
              )}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
