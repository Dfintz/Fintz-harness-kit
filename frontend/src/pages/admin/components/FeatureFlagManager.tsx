/**
 * Feature Flag Manager Component
 * Admin interface for managing feature flags
 */

import { adminKeys } from '@/hooks/queries/queryKeys';
import { apiClient } from '@/services/apiClient';
import { logger } from '@/utils/logger';
import {
  Cancel,
  CheckCircle as CheckmarkCircle,
  Delete as DeleteIcon,
  Edit as EditIcon,
  InfoOutlined,
} from '@mui/icons-material';
import Add from '@mui/icons-material/Add';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import './admin-tables.css';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Item } from '@/components/ui/Item';
import { Select } from '@/components/ui/Select';
import {
  NumberField,
  StatusLight,
  TypographyArea,
  TypographyField,
} from '@/components/ui/SpectrumCompat';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  status: 'enabled' | 'disabled' | 'beta' | 'percentage';
  scope: 'global' | 'organization' | 'user' | 'beta_users';
  rolloutPercentage?: number;
  metadata?: Record<string, any>;
}

export const FeatureFlagManager: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: flagsData } = useQuery({
    queryKey: adminKeys.featureFlags(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<FeatureFlag[]>('/api/v2/admin/feature-flags');
        const data = response.data;
        return Array.isArray(data) ? data : [];
      } catch (error) {
        logger.error(
          'Failed to fetch feature flags:',
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    },
  });

  const flags = flagsData ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    status: 'disabled' as FeatureFlag['status'],
    scope: 'global' as FeatureFlag['scope'],
    rolloutPercentage: 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: {
      isEdit: boolean;
      payload: Record<string, unknown>;
      flagId: string;
    }) => {
      if (input.isEdit) {
        await apiClient.put(`/api/v2/admin/feature-flags/${input.flagId}`, input.payload);
      } else {
        await apiClient.post('/api/v2/admin/feature-flags', input.payload);
      }
    },
    onSuccess: () => {
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: adminKeys.featureFlags() });
    },
    onError: error => {
      logger.error(
        'Failed to save feature flag:',
        error instanceof Error ? error : new Error(String(error))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (flagId: string) => {
      await apiClient.delete(`/api/v2/admin/feature-flags/${flagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.featureFlags() });
    },
    onError: error => {
      logger.error(
        'Failed to delete feature flag:',
        error instanceof Error ? error : new Error(String(error))
      );
    },
  });

  const slugify = (text: string): string => {
    let result = text.toLowerCase().trim();
    // Remove non-alphanumeric characters (except spaces and hyphens)
    result = Array.from(result)
      .filter(c => /[a-z0-9\s-]/.test(c))
      .join('');
    // Replace spaces/underscores with hyphens
    result = result.split(/[\s_]+/).join('-');
    // Collapse multiple hyphens
    result = result.split(/-+/).join('-');
    // Trim leading/trailing hyphens
    result = result.replace(/^-/, '').replace(/-$/, '');
    return result;
  };

  const handleCreate = () => {
    setEditingFlag(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      status: 'disabled',
      scope: 'global',
      rolloutPercentage: 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setFormData({
      id: flag.id,
      name: flag.name,
      description: flag.description,
      status: flag.status,
      scope: flag.scope,
      rolloutPercentage: flag.rolloutPercentage || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate({ isEdit: !!editingFlag, payload: formData, flagId: formData.id });
  };

  const handleDelete = (flagId: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) return;
    deleteMutation.mutate(flagId);
  };

  const getStatusVariant = (status: string): 'positive' | 'negative' | 'notice' | 'info' => {
    switch (status) {
      case 'enabled':
        return 'positive';
      case 'disabled':
        return 'negative';
      case 'beta':
        return 'notice';
      case 'percentage':
        return 'info';
      default:
        return 'negative';
    }
  };

  return (
    <Box>
      <Box sx={{ borderRadius: 1, p: 2, borderColor: 'primary.main', marginBottom: '24px' }}>
        <Stack direction="row" gap={1} alignItems="center">
          <InfoOutlined sx={{ color: 'primary.main' }} />
          <Typography>
            <strong>Feature Flags:</strong> Control feature availability across the platform.
            Changes take effect immediately for new requests.
          </Typography>
        </Stack>
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h3">Feature Flags ({flags.length})</Typography>
        <Button variant="primary" onClick={handleCreate}>
          <Add />
          <Typography>Create Feature Flag</Typography>
        </Button>
      </Stack>

      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Box sx={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Feature ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Scope</th>
                <th>Rollout %</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map(flag => (
                <tr key={flag.id}>
                  <td>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {flag.id}
                    </Typography>
                  </td>
                  <td>
                    <Typography sx={{ fontWeight: 'bold' }}>{flag.name}</Typography>
                  </td>
                  <td>
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                      {flag.description}
                    </Typography>
                  </td>
                  <td>
                    <Stack direction="row" gap={1} alignItems="center">
                      {flag.status === 'enabled' ? (
                        <CheckmarkCircle sx={{ color: 'success.main', fontSize: '1rem' }} />
                      ) : (
                        <Cancel sx={{ color: 'error.main', fontSize: '1rem' }} />
                      )}
                      <StatusLight variant={getStatusVariant(flag.status)}>
                        {flag.status}
                      </StatusLight>
                    </Stack>
                  </td>
                  <td>
                    <StatusLight variant="neutral">{flag.scope}</StatusLight>
                  </td>
                  <td>{flag.status === 'percentage' ? `${flag.rolloutPercentage}%` : '-'}</td>
                  <td className="text-right">
                    <Stack direction="row" gap={1} justifyContent="end">
                      <IconButton aria-label="Edit flag" onClick={() => handleEdit(flag)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label="Delete flag" onClick={() => handleDelete(flag.id)}>
                        <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                      </IconButton>
                    </Stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFlag ? 'Edit Feature Flag' : 'Create Feature Flag'}</DialogTitle>
        <DialogContent>
          <Stack direction="column" gap={2} sx={{ mt: 2 }}>
            <TypographyField
              label="Name"
              value={formData.name}
              onChange={value =>
                setFormData({
                  ...formData,
                  name: value,
                  ...(editingFlag ? {} : { id: slugify(value) }),
                })
              }
              isRequired
            />
            <TypographyField
              label="Feature ID"
              value={formData.id}
              onChange={value => setFormData({ ...formData, id: value })}
              disabled={!!editingFlag}
              isRequired
            />
            <TypographyArea
              label="Description"
              value={formData.description}
              onChange={value => setFormData({ ...formData, description: value })}
              isRequired
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={key => setFormData({ ...formData, status: key as FeatureFlag['status'] })}
            >
              <Item key="enabled">Enabled</Item>
              <Item key="disabled">Disabled</Item>
              <Item key="beta">Beta</Item>
              <Item key="percentage">Percentage Rollout</Item>
            </Select>
            <Select
              label="Scope"
              value={formData.scope}
              onChange={key => setFormData({ ...formData, scope: key as FeatureFlag['scope'] })}
            >
              <Item key="global">Global</Item>
              <Item key="organization">Organization</Item>
              <Item key="user">User</Item>
              <Item key="beta_users">Beta Users</Item>
            </Select>
            {formData.status === 'percentage' && (
              <NumberField
                label="Rollout Percentage"
                value={formData.rolloutPercentage}
                onChange={value => setFormData({ ...formData, rolloutPercentage: value })}
                minValue={0}
                maxValue={100}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {editingFlag ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
