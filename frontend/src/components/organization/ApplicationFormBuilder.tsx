import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

import type { ApplicationQuestion, ApplicationQuestionType } from '@sc-fleet-manager/shared-types';

const QUESTION_TYPE_LABELS: Record<ApplicationQuestionType, string> = {
  short: 'Short Answer',
  paragraph: 'Paragraph',
  select: 'Select (Dropdown)',
  checkbox: 'Checkbox',
  rules: 'Server Rules (Accept)',
};

const MAX_QUESTIONS = 20;

interface ApplicationFormBuilderProps {
  questions: ApplicationQuestion[];
  onChange: (questions: ApplicationQuestion[]) => void;
  disabled?: boolean;
}

export const ApplicationFormBuilder: React.FC<Readonly<ApplicationFormBuilderProps>> = ({
  questions,
  onChange,
  disabled = false,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addQuestion = useCallback(() => {
    if (questions.length >= MAX_QUESTIONS) return;
    const newQuestion: ApplicationQuestion = {
      id: crypto.randomUUID(),
      label: '',
      type: 'short',
      required: false,
      order: questions.length,
    };
    onChange([...questions, newQuestion]);
    setExpandedId(newQuestion.id);
  }, [questions, onChange]);

  const removeQuestion = useCallback(
    (id: string) => {
      const updated = questions.filter(q => q.id !== id).map((q, i) => ({ ...q, order: i }));
      onChange(updated);
      if (expandedId === id) setExpandedId(null);
    },
    [questions, onChange, expandedId]
  );

  const updateQuestion = useCallback(
    (id: string, changes: Partial<ApplicationQuestion>) => {
      onChange(questions.map(q => (q.id === id ? { ...q, ...changes } : q)));
    },
    [questions, onChange]
  );

  const moveQuestion = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= questions.length) return;
      const updated = [...questions];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      onChange(updated.map((q, i) => ({ ...q, order: i })));
    },
    [questions, onChange]
  );

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Application Form Questions
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Define custom questions that applicants must answer when applying to join your organization.
        Applicants will see these questions instead of the simple message field.
      </Typography>

      {questions.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No custom questions defined. Applicants will see a simple message-only form. Add questions
          below to create a custom application form.
        </Alert>
      )}

      <Stack spacing={2}>
        {questions.map((question, index) => {
          const isExpanded = expandedId === question.id;
          return (
            <Card
              key={question.id}
              variant="outlined"
              sx={{
                borderColor: isExpanded ? 'primary.main' : 'divider',
                cursor: 'pointer',
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {/* Summary row */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  onClick={() => setExpandedId(isExpanded ? null : question.id)}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', minWidth: 24, textAlign: 'center' }}
                  >
                    {index + 1}.
                  </Typography>
                  <Typography variant="body1" sx={{ flexGrow: 1, fontWeight: 500 }}>
                    {question.label || '(Untitled question)'}
                  </Typography>
                  <Chip
                    label={QUESTION_TYPE_LABELS[question.type]}
                    size="small"
                    variant="outlined"
                  />
                  {question.required && (
                    <Chip label="Required" size="small" color="warning" variant="outlined" />
                  )}
                  <Tooltip title="Move up">
                    <span>
                      <IconButton
                        size="small"
                        disabled={disabled || index === 0}
                        onClick={e => {
                          e.stopPropagation();
                          moveQuestion(index, 'up');
                        }}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton
                        size="small"
                        disabled={disabled || index === questions.length - 1}
                        onClick={e => {
                          e.stopPropagation();
                          moveQuestion(index, 'down');
                        }}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remove question">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={disabled}
                        onClick={e => {
                          e.stopPropagation();
                          removeQuestion(question.id);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>

                {/* Expanded editor */}
                {isExpanded && (
                  <Box sx={{ mt: 2, pl: 4 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={2}>
                      <TextField
                        label="Question Label"
                        value={question.label}
                        onChange={e => updateQuestion(question.id, { label: e.target.value })}
                        size="small"
                        fullWidth
                        disabled={disabled}
                        slotProps={{ htmlInput: { maxLength: 200 } }}
                      />

                      <Stack direction="row" spacing={2}>
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                          <InputLabel>Question Type</InputLabel>
                          <Select
                            value={question.type}
                            label="Question Type"
                            onChange={e =>
                              updateQuestion(question.id, {
                                type: e.target.value as ApplicationQuestionType,
                              })
                            }
                            disabled={disabled}
                          >
                            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                              <MenuItem key={value} value={value}>
                                {label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControlLabel
                          control={
                            <Switch
                              checked={question.required}
                              onChange={(_e, checked) =>
                                updateQuestion(question.id, { required: checked })
                              }
                              disabled={disabled}
                            />
                          }
                          label="Required"
                        />
                      </Stack>

                      <TextField
                        label="Placeholder (optional)"
                        value={question.placeholder ?? ''}
                        onChange={e =>
                          updateQuestion(question.id, { placeholder: e.target.value || undefined })
                        }
                        size="small"
                        fullWidth
                        disabled={disabled}
                        slotProps={{ htmlInput: { maxLength: 200 } }}
                      />

                      {(question.type === 'short' || question.type === 'paragraph') && (
                        <TextField
                          label="Max Length (optional)"
                          type="number"
                          value={question.maxLength ?? ''}
                          onChange={e => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            updateQuestion(question.id, { maxLength: val });
                          }}
                          size="small"
                          sx={{ maxWidth: 200 }}
                          disabled={disabled}
                          slotProps={{ htmlInput: { min: 1, max: 5000 } }}
                        />
                      )}

                      {question.type === 'select' && (
                        <Box>
                          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                            Options (one per line)
                          </Typography>
                          <TextField
                            multiline
                            rows={3}
                            value={(question.options ?? []).join('\n')}
                            onChange={e => {
                              const options = e.target.value
                                .split('\n')
                                .map(o => o.trim())
                                .filter(Boolean)
                                .slice(0, 20);
                              updateQuestion(question.id, { options });
                            }}
                            size="small"
                            fullWidth
                            disabled={disabled}
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                            helperText="Maximum 20 options"
                          />
                        </Box>
                      )}
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Button
        startIcon={<AddIcon />}
        onClick={addQuestion}
        disabled={disabled || questions.length >= MAX_QUESTIONS}
        sx={{ mt: 2 }}
        variant="outlined"
        size="small"
      >
        Add Question {questions.length > 0 && `(${questions.length}/${MAX_QUESTIONS})`}
      </Button>
    </Box>
  );
};
