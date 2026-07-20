/**
 * Security Level Manager Component
 * Manages inter-organization security levels and trust relationships
 */

import { useAlliances } from '@/hooks/queries/useAllianceQueries';
import { useMyFederations } from '@/hooks/queries/useFederationManagementQueries';
import { useOrgRelationships } from '@/hooks/queries/useRelationshipQueries';
import {
  SecurityLevel,
  securityLevelService,
  SetSecurityLevelInput,
} from '@/services/securityLevelService';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { buildRelatedOrganizationOptions } from '@/utils/relatedOrganizationOptions';
import {
  Add as AddIcon,
  Block as BlockIcon,
  Bolt as BoltIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface SecurityLevelManagerProps {
  organizationId?: string; // If provided, shows levels for specific org
  organizationName?: string; // Display name for the source org
  isAdmin?: boolean; // If true, shows all levels and allows management
}

export const SecurityLevelManager: React.FC<SecurityLevelManagerProps> = ({
  organizationId,
  organizationName,
  isAdmin = false,
}) => {
  const theme = useTheme();
  const notification = useNotification();
  const [securityLevels, setSecurityLevels] = useState<SecurityLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<SecurityLevel | null>(null);

  // Fetch cross-org relationship sources to populate target org dropdown
  const { data: alliances = [], isLoading: alliancesLoading } = useAlliances();
  const { data: relationshipsData, isLoading: relationshipsLoading } = useOrgRelationships(
    organizationId || undefined
  );
  const { data: federations = [], isLoading: federationsLoading } = useMyFederations();

  // Build list of related orgs from diplomacy relationships, treaties, and federations.
  const relatedOrgs = useMemo(() => {
    if (!organizationId) return [];
    return buildRelatedOrganizationOptions({
      organizationId,
      relationships: relationshipsData?.data ?? [],
      alliances,
      federations,
    });
  }, [organizationId, relationshipsData, alliances, federations]);

  const relatedOrgsLoading = alliancesLoading || relationshipsLoading || federationsLoading;

  const describeSource = (source: string): string => {
    if (source === 'relationship') return 'relationship';
    if (source === 'treaty') return 'treaty';
    if (source === 'federation') return 'federation';
    return source;
  };

  // Form state
  const [formData, setFormData] = useState<SetSecurityLevelInput>({
    sourceOrgId: '',
    targetOrgId: '',
    level: 1,
    resourceType: '*',
    accessLevel: 'read',
    notes: '',
  });

  // Load security levels
  const fetchSecurityLevels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let levels: SecurityLevel[];
      if (isAdmin && !organizationId) {
        // Admin viewing all levels
        levels = await securityLevelService.getAllSecurityLevels();
      } else if (organizationId) {
        // Viewing levels for specific organization
        levels = await securityLevelService.getOrgSecurityLevels(organizationId);
      } else {
        levels = [];
      }

      setSecurityLevels(levels);
    } catch (err) {
      logger.error('Failed to fetch security levels:', err);
      setError('Failed to load security levels');
    } finally {
      setLoading(false);
    }
  }, [organizationId, isAdmin]);

  useEffect(() => {
    fetchSecurityLevels();
  }, [fetchSecurityLevels]);

  const handleOpenDialog = (level?: SecurityLevel) => {
    if (level) {
      setEditingLevel(level);
      setFormData({
        sourceOrgId: level.sourceOrgId,
        targetOrgId: level.targetOrgId,
        level: level.level,
        resourceType: level.resourceType,
        accessLevel: level.accessLevel,
        notes: level.notes || '',
        restrictions: level.restrictions,
        expiresAt: level.expiresAt,
      });
    } else {
      setEditingLevel(null);
      setFormData({
        sourceOrgId: organizationId || '',
        targetOrgId: '',
        level: 1,
        resourceType: '*',
        accessLevel: 'read',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLevel(null);
    setFormData({
      sourceOrgId: organizationId || '',
      targetOrgId: '',
      level: 1,
      resourceType: '*',
      accessLevel: 'read',
      notes: '',
    });
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      await securityLevelService.setSecurityLevel(formData);
      await fetchSecurityLevels();
      handleCloseDialog();
    } catch (err) {
      logger.error('Failed to set security level:', err);
      notification.error('Failed to save security level');
    }
  };

  const handleRevoke = async (level: SecurityLevel) => {
    if (
      !confirm(
        `Are you sure you want to revoke security level from ${level.sourceOrgName} to ${level.targetOrgName}?`
      )
    ) {
      return;
    }

    try {
      await securityLevelService.revokeSecurityLevel({
        sourceOrgId: level.sourceOrgId,
        targetOrgId: level.targetOrgId,
        resourceType: level.resourceType,
      });
      await fetchSecurityLevels();
    } catch (err) {
      logger.error('Failed to revoke security level:', err);
      notification.error('Failed to revoke security level');
    }
  };

  const getSecurityLevelChip = (level: number) => {
    const severity = securityLevelService.getSecurityLevelSeverity(level);
    const label = securityLevelService.getSecurityLevelLabel(level);
    const color = severity === 'text' ? theme.palette.text.secondary : theme.palette[severity].main;

    return (
      <Tooltip title={label}>
        <Chip
          label={`Level ${level}`}
          size="small"
          sx={{
            backgroundColor: color,
            color: 'white',
            fontWeight: 'bold',
          }}
        />
      </Tooltip>
    );
  };

  const getAccessLevelChip = (accessLevel: string) => {
    const icon = securityLevelService.getAccessLevelIcon(accessLevel);
    const label = securityLevelService.getAccessLevelLabel(accessLevel);

    return (
      <Chip label={`${icon} ${label}`} size="small" variant="outlined" sx={{ fontWeight: 500 }} />
    );
  };

  if (loading) {
    return <Typography>Loading security levels...</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Inter-Organization Security Levels
        </Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add Security Level
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Security Levels:</strong> Control cross-organization access and collaboration.
        </Typography>
        <Typography variant="caption" display="block" mt={1}>
          • Levels 1-3: Public/Low - Basic information sharing
          <br />
          • Levels 4-6: Restricted/Medium - Operational details, fleet compositions
          <br />
          • Levels 7-9: Confidential/High - Strategic intelligence, attack plans
          <br />• Level 10: Top Secret - Full access, critical operations
        </Typography>
      </Alert>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Source Organization</TableCell>
              <TableCell>Target Organization</TableCell>
              <TableCell>Security Level</TableCell>
              <TableCell>Resource Type</TableCell>
              <TableCell>Access Level</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expires</TableCell>
              {isAdmin && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {securityLevels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} align="center">
                  <Typography color="textSecondary" py={3}>
                    No security levels configured
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              securityLevels.map(level => (
                <TableRow key={level.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {level.sourceOrgName || level.sourceOrgId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {level.targetOrgName || level.targetOrgId}
                    </Typography>
                  </TableCell>
                  <TableCell>{getSecurityLevelChip(level.level)}</TableCell>
                  <TableCell>
                    <Chip label={level.resourceType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{getAccessLevelChip(level.accessLevel)}</TableCell>
                  <TableCell>
                    <Chip
                      label={level.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={level.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {level.expiresAt ? (
                      <Typography variant="caption">
                        {new Date(level.expiresAt).toLocaleDateString()}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="textSecondary">
                        Never
                      </Typography>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenDialog(level)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Details">
                        <IconButton size="small">
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Revoke">
                        <IconButton size="small" onClick={() => handleRevoke(level)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingLevel ? 'Edit Security Level' : 'Add Security Level'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Source Organization"
              value={organizationName || formData.sourceOrgId}
              fullWidth
              required
              disabled
              helperText="Your organization (auto-filled)"
            />

            <FormControl fullWidth required disabled={!!editingLevel}>
              <InputLabel>Target Organization</InputLabel>
              <Select
                value={formData.targetOrgId}
                label="Target Organization"
                onChange={e => setFormData({ ...formData, targetOrgId: e.target.value })}
              >
                {relatedOrgsLoading && (
                  <MenuItem disabled>
                    <CircularProgress size={16} sx={{ mr: 1 }} /> Loading relationships...
                  </MenuItem>
                )}
                {!relatedOrgsLoading && relatedOrgs.length === 0 && (
                  <MenuItem disabled>
                    No diplomatic, treaty, or federation member organizations found
                  </MenuItem>
                )}
                {relatedOrgs.map(org => (
                  <MenuItem key={org.id} value={org.id}>
                    <ListItemText
                      primary={org.name}
                      secondary={`${org.id} — via ${org.sources.map(describeSource).join(', ')}`}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Security Level</InputLabel>
              <Select
                value={formData.level}
                label="Security Level"
                onChange={e => setFormData({ ...formData, level: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lvl => (
                  <MenuItem key={lvl} value={lvl}>
                    Level {lvl} - {securityLevelService.getSecurityLevelLabel(lvl)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Resource Type"
              value={formData.resourceType}
              onChange={e => setFormData({ ...formData, resourceType: e.target.value })}
              fullWidth
              helperText="e.g., 'intelligence', 'fleet', 'operations', or '*' for all"
              disabled={!!editingLevel}
            />

            <FormControl fullWidth>
              <InputLabel>Access Level</InputLabel>
              <Select
                value={formData.accessLevel}
                label="Access Level"
                onChange={e =>
                  setFormData({
                    ...formData,
                    accessLevel: e.target.value,
                  })
                }
              >
                <MenuItem value="none">
                  <BlockIcon sx={{ fontSize: 16, mr: 0.5 }} /> No Access
                </MenuItem>
                <MenuItem value="read">
                  <ViewIcon sx={{ fontSize: 16, mr: 0.5 }} /> Read Only
                </MenuItem>
                <MenuItem value="write">
                  <EditIcon sx={{ fontSize: 16, mr: 0.5 }} /> Read & Write
                </MenuItem>
                <MenuItem value="full">
                  <BoltIcon sx={{ fontSize: 16, mr: 0.5 }} /> Full Access
                </MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Notes"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Optional notes about this security relationship"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingLevel ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
