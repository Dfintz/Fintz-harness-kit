import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';

import {
  BRIEFING_CLASSIFICATION_CHIP_COLORS,
  BRIEFING_CLASSIFICATION_LABELS,
  type Briefing,
  type BriefingClassification,
} from '@/services/briefingService';

// ============================================================================
// Types
// ============================================================================

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  draft: 'default',
  active: 'primary',
  completed: 'success',
  archived: 'warning',
};

export interface BriefingListPanelProps {
  readonly briefings: Briefing[];
  readonly selectedBriefingId: string | null;
  readonly showCreateForm: boolean;
  readonly newTitle: string;
  readonly createClassification: BriefingClassification;
  readonly onSelectBriefing: (id: string) => void;
  readonly onToggleCreateForm: () => void;
  readonly onNewTitleChange: (value: string) => void;
  readonly onCreateClassificationChange: (classification: BriefingClassification) => void;
  readonly onCreate: (e: React.FormEvent) => void;
  readonly onDeleteRequest: (id: string) => void;
}

// ============================================================================
// BriefingListPanel
// ============================================================================

export const BriefingListPanel: React.FC<BriefingListPanelProps> = ({
  briefings,
  selectedBriefingId,
  showCreateForm,
  newTitle,
  createClassification,
  onSelectBriefing,
  onToggleCreateForm,
  onNewTitleChange,
  onCreateClassificationChange,
  onCreate,
  onDeleteRequest,
}) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Briefings
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={onToggleCreateForm}>
          {showCreateForm ? 'Cancel' : 'New'}
        </Button>
      </Box>

      {showCreateForm && (
        <Box component="form" onSubmit={onCreate} sx={{ mb: 1.5 }}>
          <TextField
            size="small"
            placeholder="Briefing title..."
            value={newTitle}
            onChange={e => onNewTitleChange(e.target.value)}
            fullWidth
            autoFocus
            slotProps={{ htmlInput: { maxLength: 200 } }}
            sx={{ mb: 1 }}
          />
          <TextField
            select
            size="small"
            label="Classification"
            value={createClassification}
            onChange={e => onCreateClassificationChange(e.target.value as BriefingClassification)}
            fullWidth
            sx={{ mb: 1 }}
          >
            {(
              Object.entries(BRIEFING_CLASSIFICATION_LABELS) as [BriefingClassification, string][]
            ).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            type="submit"
            variant="contained"
            size="small"
            fullWidth
            disabled={!newTitle.trim()}
          >
            Create
          </Button>
        </Box>
      )}

      <List dense disablePadding>
        {briefings.map(b => (
          <ListItemButton
            key={b.id}
            selected={selectedBriefingId === b.id}
            onClick={() => onSelectBriefing(b.id)}
            sx={{ borderRadius: 1, mb: 0.5 }}
          >
            <ListItemText
              primary={b.title}
              secondary={
                <Box
                  component="span"
                  sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center' }}
                >
                  <Chip
                    label={b.status}
                    size="small"
                    color={STATUS_COLORS[b.status] ?? 'default'}
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                  <Chip
                    icon={<SecurityIcon sx={{ fontSize: '0.7rem !important' }} />}
                    label={BRIEFING_CLASSIFICATION_LABELS[b.classification] ?? b.classification}
                    size="small"
                    color={BRIEFING_CLASSIFICATION_CHIP_COLORS[b.classification] ?? 'default'}
                    sx={{ height: 18, fontSize: '0.6rem' }}
                  />
                  {(b.operationIds?.length ?? 0) > 0 && (
                    <Chip
                      label={`${b.operationIds!.length} op${b.operationIds!.length > 1 ? 's' : ''}`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: '0.6rem' }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    v{b.version} &middot; {b.elements.length} el.
                  </Typography>
                </Box>
              }
            />
            <IconButton
              size="small"
              edge="end"
              onClick={e => {
                e.stopPropagation();
                onDeleteRequest(b.id);
              }}
              aria-label={`Delete ${b.title}`}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
        {briefings.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No briefings yet
          </Typography>
        )}
      </List>
    </CardContent>
  </Card>
);
