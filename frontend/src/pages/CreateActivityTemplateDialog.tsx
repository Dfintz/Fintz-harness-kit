/**
 * CreateActivityTemplateDialog
 * Dialog for creating or editing an activity template.
 *
 * Sprint 19-D — Activity Templates Frontend
 */

import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useCreateActivityTemplate,
  useUpdateActivityTemplate,
} from '@/hooks/queries/useActivityTemplateQueries';
import { useShipCatalogue } from '@/hooks/queries/useShipCatalogueQueries';
import { useNotification } from '@/store/uiStore';
import {
  ActivityTemplateCategory,
  type ActivityTemplate,
  type ActivityTemplateData,
  type CreateActivityTemplateInput,
} from '@/types/apiV2';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface CreateActivityTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  /** When provided the dialog switches to edit mode */
  template?: ActivityTemplate;
}

interface TemplateFormState extends CreateActivityTemplateInput {
  templateData: ActivityTemplateData;
}

// ============================================================================
// Constants
// ============================================================================

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'mission', label: 'Mission' },
  { value: 'contract', label: 'Contract' },
  { value: 'bounty', label: 'Bounty' },
  { value: 'event', label: 'Event' },
  { value: 'lfg', label: 'LFG' },
  { value: 'operation', label: 'Operation' },
  { value: 'job_listing', label: 'Job Listing' },
];

const CATEGORY_OPTIONS: { value: ActivityTemplateCategory; label: string }[] = [
  { value: ActivityTemplateCategory.COMBAT, label: 'Combat' },
  { value: ActivityTemplateCategory.MINING, label: 'Mining' },
  { value: ActivityTemplateCategory.TRADING, label: 'Trading' },
  { value: ActivityTemplateCategory.EXPLORATION, label: 'Exploration' },
  { value: ActivityTemplateCategory.LOGISTICS, label: 'Logistics' },
  { value: ActivityTemplateCategory.SOCIAL, label: 'Social' },
  { value: ActivityTemplateCategory.TRAINING, label: 'Training' },
  { value: ActivityTemplateCategory.CUSTOM, label: 'Custom' },
];

const EMPTY_TEMPLATE_DATA: ActivityTemplateData = {
  maxParticipants: undefined,
  minParticipants: undefined,
  estimatedDuration: undefined,
  locationSystem: '',
  locationPlanet: '',
  locationDetails: '',
  requiredShips: [],
  preferredShips: [],
};

const EMPTY_FORM: TemplateFormState = {
  name: '',
  description: '',
  activityType: 'mission',
  category: ActivityTemplateCategory.CUSTOM,
  isPublic: false,
  tags: [],
  templateData: { ...EMPTY_TEMPLATE_DATA },
};

// ============================================================================
// Component
// ============================================================================

export const CreateActivityTemplateDialog: React.FC<
  Readonly<CreateActivityTemplateDialogProps>
> = ({ open, onClose, template }) => {
  const isEdit = !!template;
  const createTemplate = useCreateActivityTemplate();
  const updateTemplate = useUpdateActivityTemplate();
  const { data: catalogueData } = useShipCatalogue({ limit: 500 }, open);
  const notification = useNotification();

  const [form, setForm] = useState<TemplateFormState>({ ...EMPTY_FORM });

  const shipOptions = useMemo(() => {
    if (!catalogueData?.items) return [];
    return catalogueData.items.map(s => s.name).sort((a, b) => a.localeCompare(b));
  }, [catalogueData]);

  // Populate form when editing
  useEffect(() => {
    if (template) {
      setForm({
        name: template.name,
        description: template.description ?? '',
        activityType: template.activityType,
        category: template.category,
        isPublic: template.isPublic,
        tags: template.tags ?? [],
        templateData: {
          ...EMPTY_TEMPLATE_DATA,
          ...template.templateData,
        },
      });
    } else {
      setForm({ ...EMPTY_FORM, templateData: { ...EMPTY_TEMPLATE_DATA } });
    }
  }, [template]);

  const handleTextChange = useCallback(
    (field: keyof CreateActivityTemplateInput) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleSelectChange = useCallback(
    (field: keyof CreateActivityTemplateInput) => (e: SelectChangeEvent<string>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  const handleTemplateDataChange = useCallback(
    (field: keyof ActivityTemplateData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const raw = e.target.value;
        const isNumeric = ['maxParticipants', 'minParticipants', 'estimatedDuration'].includes(
          field
        );
        let value: string | number | undefined = raw;
        if (isNumeric) {
          value = raw === '' ? undefined : Number(raw);
        }
        setForm(prev => ({
          ...prev,
          templateData: { ...prev.templateData, [field]: value },
        }));
      },
    []
  );

  const handleTagsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    setForm(prev => ({ ...prev, tags }));
  }, []);

  const handlePublicChange = useCallback(
    (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setForm(prev => ({ ...prev, isPublic: checked }));
    },
    []
  );

  const handleShipsChange = useCallback(
    (field: 'requiredShips' | 'preferredShips') => (_: React.SyntheticEvent, value: string[]) => {
      setForm(prev => ({
        ...prev,
        templateData: { ...prev.templateData, [field]: value },
      }));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) return;
    try {
      // Build payload — strip empty templateData fields
      const payload: CreateActivityTemplateInput = {
        name: form.name,
        description: form.description,
        activityType: form.activityType,
        category: form.category,
        isPublic: form.isPublic,
        tags: form.tags,
        templateData: form.templateData,
      };
      if (isEdit && template) {
        await updateTemplate.mutateAsync({ templateId: template.id, data: payload });
      } else {
        await createTemplate.mutateAsync(payload);
      }
      setForm({ ...EMPTY_FORM, templateData: { ...EMPTY_TEMPLATE_DATA } });
      onClose();
    } catch (err) {
      const verb = isEdit ? 'update' : 'create';
      const message = err instanceof Error ? err.message : `Failed to ${verb} template`;
      notification.error(message);
      logger.error(
        `Failed to ${isEdit ? 'update' : 'create'} template`,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [form, isEdit, template, createTemplate, updateTemplate, onClose]);

  const handleClose = useCallback(() => {
    setForm({ ...EMPTY_FORM, templateData: { ...EMPTY_TEMPLATE_DATA } });
    onClose();
  }, [onClose]);

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  let buttonLabel: string;
  if (isPending) {
    buttonLabel = isEdit ? 'Saving\u2026' : 'Creating\u2026';
  } else {
    buttonLabel = isEdit ? 'Save Changes' : 'Create Template';
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Template' : 'Create Activity Template'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* ── Basic Info ── */}
          <TextField
            label="Template Name"
            value={form.name}
            onChange={handleTextChange('name')}
            required
            fullWidth
            autoFocus
            placeholder="e.g., Friday Night Mining Run"
          />

          <TextField
            label="Description"
            value={form.description ?? ''}
            onChange={handleTextChange('description')}
            fullWidth
            multiline
            rows={3}
            placeholder="Describe what this template is for…"
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Activity Type</InputLabel>
              <Select
                value={form.activityType}
                label="Activity Type"
                onChange={handleSelectChange('activityType')}
              >
                {ACTIVITY_TYPE_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={form.category ?? 'custom'}
                label="Category"
                onChange={handleSelectChange('category')}
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* ── Participants & Duration ── */}
          <Divider />
          <Typography variant="subtitle2" color="text.secondary">
            Participants &amp; Duration
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Min Participants"
              type="number"
              value={form.templateData.minParticipants ?? ''}
              onChange={handleTemplateDataChange('minParticipants')}
              fullWidth
              slotProps={{ htmlInput: { min: 1, max: 200 } }}
            />
            <TextField
              label="Max Participants"
              type="number"
              value={form.templateData.maxParticipants ?? ''}
              onChange={handleTemplateDataChange('maxParticipants')}
              fullWidth
              slotProps={{ htmlInput: { min: 1, max: 200 } }}
            />
            <TextField
              label="Duration (min)"
              type="number"
              value={form.templateData.estimatedDuration ?? ''}
              onChange={handleTemplateDataChange('estimatedDuration')}
              fullWidth
              slotProps={{ htmlInput: { min: 1, max: 1440 } }}
            />
          </Stack>

          {/* ── Location ── */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Star System"
              value={form.templateData.locationSystem ?? ''}
              onChange={handleTemplateDataChange('locationSystem')}
              fullWidth
              placeholder="e.g., Stanton"
            />
            <TextField
              label="Planet / Moon"
              value={form.templateData.locationPlanet ?? ''}
              onChange={handleTemplateDataChange('locationPlanet')}
              fullWidth
              placeholder="e.g., microTech"
            />
          </Stack>

          <TextField
            label="Location Details"
            value={form.templateData.locationDetails ?? ''}
            onChange={handleTemplateDataChange('locationDetails')}
            fullWidth
            placeholder="e.g., New Babbage, TDD"
          />

          {/* ── Ships ── */}
          <Divider />
          <Typography variant="subtitle2" color="text.secondary">
            Ship Requirements
          </Typography>

          <Autocomplete
            multiple
            freeSolo
            options={shipOptions}
            value={form.templateData.requiredShips ?? []}
            onChange={handleShipsChange('requiredShips')}
            slotProps={{
              chip: { size: 'small', color: 'error' },
            }}
            renderInput={params => (
              <TextField
                {...params}
                label="Required Ships"
                placeholder="Type or select ships…"
                helperText="Ships that participants must bring"
              />
            )}
          />

          <Autocomplete
            multiple
            freeSolo
            options={shipOptions}
            value={form.templateData.preferredShips ?? []}
            onChange={handleShipsChange('preferredShips')}
            slotProps={{
              chip: { size: 'small', color: 'primary' },
            }}
            renderInput={params => (
              <TextField
                {...params}
                label="Preferred Ships"
                placeholder="Type or select ships…"
                helperText="Ships that are recommended but not mandatory"
              />
            )}
          />

          {/* ── Tags & Visibility ── */}
          <Divider />

          <TextField
            label="Tags"
            value={(form.tags ?? []).join(', ')}
            onChange={handleTagsChange}
            fullWidth
            placeholder="Separate tags with commas"
            helperText="e.g., pvp, high-risk, weekly"
          />

          <FormControlLabel
            control={<Checkbox checked={!!form.isPublic} onChange={handlePublicChange} />}
            label="Make template public (visible to all organizations)"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!form.name.trim() || isPending}
        >
          {buttonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
