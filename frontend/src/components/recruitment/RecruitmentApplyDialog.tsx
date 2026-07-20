import { SignInGate } from '@/components/SignInGate';
import { useApplicationMode } from '@/hooks/queries/useApplicationQueries';
import { useApplyToRecruitment } from '@/hooks/queries/useRecruitmentQueries';
import { isApiClientError } from '@/services/apiClient';
import type { Recruitment } from '@/services/recruitmentService';
import { logger } from '@/utils/logger';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Checkbox,
  Chip,
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, type Theme, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';

import type { ApplicationQuestion } from '@sc-fleet-manager/shared-types';

// ── Reusable field styling ──────────────────────────────────────────

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

// ── Question field renderer ─────────────────────────────────────────

interface QuestionFieldProps {
  question: ApplicationQuestion;
  value: string;
  onChange: (questionId: string, value: string) => void;
  disabled: boolean;
  theme: Theme;
}

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
            {question.required && (
              <Typography component="span" sx={{ color: theme.palette.error.main }}>
                {' *'}
              </Typography>
            )}
          </Typography>
        }
      />
    );
  }

  return null;
};

// ── Form body sub-component (extracted to avoid nested ternary) ─────

interface RecruitmentApplyFormProps {
  recruitment: Recruitment;
  modeLoading: boolean;
  hasCustomQuestions: boolean;
  questions: ApplicationQuestion[];
  message: string;
  setMessage: (v: string) => void;
  formResponses: Record<string, string>;
  updateFormResponse: (id: string, value: string) => void;
  isSubmitting: boolean;
  error: string | null;
  fieldSx: ReturnType<typeof FIELD_SX>;
  theme: Theme;
}

const MAX_MESSAGE_LENGTH = 2000;

const RecruitmentApplyForm: React.FC<Readonly<RecruitmentApplyFormProps>> = ({
  recruitment,
  modeLoading,
  hasCustomQuestions,
  questions,
  message,
  setMessage,
  formResponses,
  updateFormResponse,
  isSubmitting,
  error,
  fieldSx,
  theme,
}) => {
  if (modeLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      {/* Recruitment info summary */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
          Applying to <strong>{recruitment.organizationName ?? 'this organization'}</strong>
        </Typography>
        {recruitment.rolesNeeded && recruitment.rolesNeeded.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {recruitment.rolesNeeded.map(role => (
              <Chip key={role} label={role} size="small" color="info" variant="outlined" />
            ))}
          </Stack>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label={hasCustomQuestions ? 'Additional Message (optional)' : 'Message'}
          multiline
          rows={hasCustomQuestions ? 2 : 3}
          fullWidth
          value={message}
          onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          placeholder="Tell the organization about yourself and why you'd like to join..."
          helperText={`${message.length}/${MAX_MESSAGE_LENGTH} characters`}
          disabled={isSubmitting}
          sx={fieldSx}
        />

        {hasCustomQuestions && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...questions]
              .sort((a, b) => a.order - b.order)
              .map(question => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={formResponses[question.id] ?? ''}
                  onChange={updateFormResponse}
                  disabled={isSubmitting}
                  theme={theme}
                />
              ))}
          </Box>
        )}
      </Box>

      {error && (
        <Typography variant="body2" sx={{ color: theme.palette.error.light, mt: 1 }}>
          {error}
        </Typography>
      )}
    </>
  );
};

// ── Main Dialog ─────────────────────────────────────────────────────

interface RecruitmentApplyDialogProps {
  open: boolean;
  onClose: () => void;
  recruitment: Recruitment;
  onSuccess?: () => void;
}

export const RecruitmentApplyDialog: React.FC<RecruitmentApplyDialogProps> = ({
  open,
  onClose,
  recruitment,
  onSuccess,
}) => {
  const theme = useTheme();
  const applyMutation = useApplyToRecruitment();

  const [message, setMessage] = useState('');
  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the org's custom application questions
  const { data: modeInfo, isPending: modeLoading } = useApplicationMode(
    recruitment.organizationId,
    open
  );

  // Prefer recruitment-specific questions (snapshot at create time);
  // fall back to org-level questions for older recruitments without a snapshot.
  const recruitmentQuestions: ApplicationQuestion[] = recruitment.applicationQuestions ?? [];
  const questions =
    recruitmentQuestions.length > 0 ? recruitmentQuestions : (modeInfo?.questions ?? []);
  const hasCustomQuestions = questions.length > 0;

  const updateFormResponse = (questionId: string, value: string) => {
    setFormResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setError(null);

    // Validate required custom questions
    if (hasCustomQuestions) {
      const missing = questions.filter(q => q.required).find(q => !formResponses[q.id]?.trim());
      if (missing) {
        setError(`Please answer the required question: "${missing.label}"`);
        return;
      }
    }

    try {
      // Map form responses to the answers array format the backend expects
      const answers = hasCustomQuestions
        ? questions
            .filter(q => formResponses[q.id]?.trim())
            .map(q => ({
              questionId: q.id,
              question: q.label,
              answer: formResponses[q.id],
            }))
        : undefined;

      await applyMutation.mutateAsync({
        id: recruitment.id,
        data: {
          message: message || undefined,
          answers,
        },
      });
      setSubmitted(true);
      onSuccess?.();
    } catch (err: unknown) {
      if (isApiClientError(err) && err.statusCode === 409) {
        setSubmitted(true);
        setError('You have already applied to this recruitment.');
      } else {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to submit application. Please try again.';
        setError(errorMessage);
        logger.error(
          'Recruitment apply failed',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }
  };

  const handleClose = () => {
    setMessage('');
    setFormResponses({});
    setSubmitted(false);
    setError(null);
    onClose();
  };

  const isSubmitting = applyMutation.isPending;
  const fieldSx = FIELD_SX(theme);

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
          {submitted ? 'Application Submitted' : `Apply: ${recruitment.title}`}
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
          description="You need to be logged in to apply. Sign in to submit your application."
        >
          {submitted ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: theme.palette.success.dark, mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                {error ? 'Already Applied' : 'Application Submitted!'}
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                {error ??
                  `Your application to "${recruitment.title}" has been submitted. You will be notified when it is reviewed.`}
              </Typography>
            </Box>
          ) : (
            <RecruitmentApplyForm
              recruitment={recruitment}
              modeLoading={modeLoading}
              hasCustomQuestions={hasCustomQuestions}
              questions={questions}
              message={message}
              setMessage={setMessage}
              formResponses={formResponses}
              updateFormResponse={updateFormResponse}
              isSubmitting={isSubmitting}
              error={error}
              fieldSx={fieldSx}
              theme={theme}
            />
          )}
        </SignInGate>
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
