import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useMyFederations } from '@/hooks/queries/useFederationManagementQueries';
import {
  useCreateLoadout,
  useUpdateLoadout,
  useUserLoadouts,
} from '@/hooks/queries/useLoadoutQueries';
import { useMyOrganizations } from '@/hooks/queries/useOrganizationQueries';
import type { Loadout } from '@/services/loadoutService';
import { selectUser, useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';

interface ShipLoadout extends Loadout {
  shipName?: string;
  ownerId?: string;
  erkulGamesUrl?: string;
  spViewerUrl?: string;
  sharedWithFleet?: boolean;
  sharedWithOrg?: boolean;
  sharedWithAlliance?: boolean;
}

export const SharedResourcesManager: React.FC = () => {
  const theme = useTheme();
  const authUser = useAuthStore(selectUser);
  const userId = authUser?.id || '';

  const [expandedLoadoutId, setExpandedLoadoutId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const notification = useNotification();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newShipName, setNewShipName] = useState('');
  const [newErkulUrl, setNewErkulUrl] = useState('');
  const [newSpViewerUrl, setNewSpViewerUrl] = useState('');

  // Edit dialog state
  const [editLoadout, setEditLoadout] = useState<ShipLoadout | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editShipName, setEditShipName] = useState('');
  const [editErkulUrl, setEditErkulUrl] = useState('');
  const [editSpViewerUrl, setEditSpViewerUrl] = useState('');
  const [editSharedOrgs, setEditSharedOrgs] = useState<string[]>([]);

  // React Query hooks
  const { data: userOrganizations = [] } = useMyOrganizations();
  const { data: userFederations = [] } = useMyFederations();
  const orgIds = userOrganizations.map(org => org.id).join(',');

  const {
    data: loadouts = [],
    isLoading: loading,
    error: loadoutsError,
  } = useUserLoadouts(userId || undefined, orgIds || undefined);

  const updateLoadout = useUpdateLoadout();
  const createLoadout = useCreateLoadout();

  const handleCreateLoadout = async () => {
    try {
      await createLoadout.mutateAsync({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        shipName: newShipName.trim() || undefined,
        erkulGamesUrl: newErkulUrl.trim() || undefined,
        spViewerUrl: newSpViewerUrl.trim() || undefined,
      });
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
      setNewShipName('');
      setNewErkulUrl('');
      setNewSpViewerUrl('');
      notification.success('Loadout created successfully');
    } catch (err: unknown) {
      logger.error('Failed to create loadout', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleOpenEdit = (loadout: ShipLoadout) => {
    setEditLoadout(loadout);
    setEditName(loadout.name);
    setEditDescription(loadout.description || '');
    setEditShipName(loadout.shipName || '');
    setEditErkulUrl(loadout.erkulGamesUrl || '');
    setEditSpViewerUrl(loadout.spViewerUrl || '');
    setEditSharedOrgs(loadout.sharedWithOrgs || []);
  };

  const handleCloseEdit = () => {
    setEditLoadout(null);
  };

  const handleToggleShareTarget = (id: string) => {
    setEditSharedOrgs(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleSaveEdit = async () => {
    if (!editLoadout) return;
    try {
      await updateLoadout.mutateAsync({
        loadoutId: editLoadout.id,
        data: {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          shipName: editShipName.trim() || undefined,
          erkulGamesUrl: editErkulUrl.trim() || undefined,
          spViewerUrl: editSpViewerUrl.trim() || undefined,
          sharedWithOrgs: editSharedOrgs,
        },
      });
      handleCloseEdit();
      notification.success('Loadout updated successfully');
    } catch (err: unknown) {
      logger.error('Failed to update loadout', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const getSharedWithDisplay = (loadout: ShipLoadout): string => {
    const shared: string[] = [];

    if (loadout.sharedWithFleet) shared.push('Fleet');
    if (loadout.sharedWithOrg) shared.push('Organization');
    if (loadout.sharedWithAlliance) shared.push('Alliance');

    if (loadout.sharedWithOrgs && loadout.sharedWithOrgs.length > 0) {
      const orgNames = loadout.sharedWithOrgs.map(orgId => {
        const org = userOrganizations.find(o => o.id === orgId);
        if (org) return org.name;
        const fed = userFederations.find(f => f.id === orgId);
        return fed ? fed.name : orgId;
      });
      shared.push(...orgNames);
    }

    return shared.length > 0 ? shared.join(', ') : 'Private';
  };

  const handleToggleExpand = (loadoutId: string) => {
    setExpandedLoadoutId(prev => (prev === loadoutId ? null : loadoutId));
  };

  const handleCopyLoadout = (loadout: ShipLoadout) => {
    const text = [
      `Loadout: ${loadout.name}`,
      loadout.shipName ? `Ship: ${loadout.shipName}` : '',
      loadout.description ? `Description: ${loadout.description}` : '',
      loadout.items?.length ? `Items: ${loadout.items.length}` : '',
      loadout.erkulGamesUrl ? `Erkul: ${loadout.erkulGamesUrl}` : '',
      loadout.spViewerUrl ? `SP Viewer: ${loadout.spViewerUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard
      .writeText(text)
      .then(() => {
        notification.success('Loadout copied to clipboard');
      })
      .catch(() => {
        notification.error('Failed to copy');
      });
  };

  const handleToggleFavorite = (loadoutId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(loadoutId)) {
        next.delete(loadoutId);
      } else {
        next.add(loadoutId);
      }
      return next;
    });
  };

  // Show loading state if user is not yet available
  if (!userId) {
    return <LoadingSpinner message="Loading user data..." />;
  }

  if (loading) {
    return <LoadingSpinner message="Loading shared resources..." />;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h5">Shared Ship Loadouts</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          Create Loadout
        </Button>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        View and manage ship loadouts shared across your organizations. Click a loadout to see
        details.
      </Typography>

      {/* Create Loadout Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => !createLoadout.isPending && setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Ship Loadout</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {createLoadout.error && (
              <Alert severity="error">Failed to create loadout. Please try again.</Alert>
            )}
            <TextField
              label="Loadout Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              fullWidth
              size="small"
              required
              placeholder="e.g., Combat Vanguard Build"
            />
            <TextField
              label="Ship Name"
              value={newShipName}
              onChange={e => setNewShipName(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g., Aegis Vanguard Sentinel"
            />
            <TextField
              label="Description"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder="Describe the loadout purpose and key components"
            />
            <TextField
              label="Erkul Games URL (optional)"
              value={newErkulUrl}
              onChange={e => setNewErkulUrl(e.target.value)}
              fullWidth
              size="small"
              placeholder="https://www.erkul.games/loadout/..."
            />
            <TextField
              label="SP Viewer URL (optional)"
              value={newSpViewerUrl}
              onChange={e => setNewSpViewerUrl(e.target.value)}
              fullWidth
              size="small"
              placeholder="https://spviewer.eu/..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={createLoadout.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateLoadout}
            disabled={createLoadout.isPending || newName.trim().length < 2}
          >
            {createLoadout.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activities Reference */}
      <Box
        sx={{
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          border: '1px solid',
          borderColor: 'primary.main',
          borderRadius: 2,
          p: 2,
          mb: 3,
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          <strong>Tip:</strong> Create{' '}
          <Typography
            component="a"
            href="/activities"
            variant="body2"
            sx={{ color: 'primary.main', textDecoration: 'none' }}
          >
            Activities
          </Typography>{' '}
          to plan missions and optimize these loadouts for your trade routes and operations.
        </Typography>
      </Box>

      {loadoutsError && (
        <ErrorMessage
          message={
            loadoutsError instanceof Error ? loadoutsError.message : 'Failed to fetch loadouts'
          }
        />
      )}

      {loadouts.length === 0 ? (
        <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
          No loadouts available yet.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {(loadouts as ShipLoadout[]).map(loadout => {
            const isExpanded = expandedLoadoutId === loadout.id;
            const isFavorite = favorites.has(loadout.id);
            return (
              <Card
                key={loadout.id}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: isExpanded ? 'primary.main' : 'divider',
                  transition: theme.transitions.create('border-color', { duration: 200 }),
                  '&:hover': { borderColor: 'primary.light' },
                }}
              >
                <CardActionArea onClick={() => handleToggleExpand(loadout.id)}>
                  <CardContent sx={{ pb: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="h6" sx={{ color: 'primary.main' }}>
                          {loadout.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Ship: {loadout.shipName || 'Unknown'}
                        </Typography>
                      </Box>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip
                          label={loadout.ownerId === userId ? 'Owner' : 'Shared'}
                          size="small"
                          color={loadout.ownerId === userId ? 'primary' : 'default'}
                          variant="outlined"
                        />
                        {isExpanded ? (
                          <ExpandLessIcon sx={{ color: 'text.secondary' }} />
                        ) : (
                          <ExpandMoreIcon sx={{ color: 'text.secondary' }} />
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </CardActionArea>

                <Collapse in={isExpanded}>
                  <Divider sx={{ borderColor: 'divider' }} />
                  <CardContent>
                    {loadout.description && (
                      <Typography variant="body2" sx={{ color: 'text.primary', mb: 2 }}>
                        {loadout.description}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        Shared with:
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {getSharedWithDisplay(loadout)}
                      </Typography>
                    </Stack>

                    {loadout.items && loadout.items.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          variant="body2"
                          sx={{ color: 'text.secondary', fontWeight: 600, mb: 1 }}
                        >
                          Equipment ({loadout.items.length} items)
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {loadout.items.slice(0, 10).map((item, idx) => (
                            <Chip
                              key={
                                typeof item === 'string'
                                  ? item
                                  : `item-${String((item as Record<string, unknown>)?.name ?? idx)}`
                              }
                              label={
                                typeof item === 'string'
                                  ? item
                                  : String(
                                      (item as Record<string, unknown>)?.name || `Item ${idx + 1}`
                                    )
                              }
                              size="small"
                              sx={{ bgcolor: 'action.hover', color: 'text.primary' }}
                            />
                          ))}
                          {loadout.items.length > 10 && (
                            <Chip
                              label={`+${loadout.items.length - 10} more`}
                              size="small"
                              sx={{ bgcolor: 'action.hover', color: 'text.secondary' }}
                            />
                          )}
                        </Stack>
                      </Box>
                    )}

                    <Divider sx={{ borderColor: 'divider', my: 1 }} />

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {loadout.erkulGamesUrl && (
                        <Tooltip title="View on Erkul Games">
                          <IconButton
                            size="small"
                            component="a"
                            href={loadout.erkulGamesUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            <OpenInNewIcon sx={{ color: 'primary.main' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {loadout.spViewerUrl && (
                        <Tooltip title="View on SP Viewer">
                          <IconButton
                            size="small"
                            component="a"
                            href={loadout.spViewerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            <OpenInNewIcon sx={{ color: 'secondary.main' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                        <IconButton size="small" onClick={() => handleToggleFavorite(loadout.id)}>
                          {isFavorite ? (
                            <FavoriteIcon sx={{ color: 'error.main' }} />
                          ) : (
                            <FavoriteBorderIcon sx={{ color: 'text.secondary' }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy loadout details">
                        <IconButton size="small" onClick={() => handleCopyLoadout(loadout)}>
                          <ContentCopyIcon sx={{ color: 'text.secondary' }} />
                        </IconButton>
                      </Tooltip>
                      {loadout.ownerId === userId && (
                        <Tooltip title="Edit loadout">
                          <IconButton size="small" onClick={() => handleOpenEdit(loadout)}>
                            <EditIcon sx={{ color: 'text.secondary' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </CardContent>
                </Collapse>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Edit Loadout Dialog */}
      <Dialog
        open={!!editLoadout}
        onClose={() => !updateLoadout.isPending && handleCloseEdit()}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Loadout: {editLoadout?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {updateLoadout.error && (
              <Alert severity="error">Failed to update loadout. Please try again.</Alert>
            )}
            <TextField
              label="Loadout Name"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              fullWidth
              size="small"
              required
            />
            <TextField
              label="Ship Name"
              value={editShipName}
              onChange={e => setEditShipName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Description"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
            <TextField
              label="Erkul Games URL (optional)"
              value={editErkulUrl}
              onChange={e => setEditErkulUrl(e.target.value)}
              fullWidth
              size="small"
              placeholder="https://www.erkul.games/loadout/..."
            />
            <TextField
              label="SP Viewer URL (optional)"
              value={editSpViewerUrl}
              onChange={e => setEditSpViewerUrl(e.target.value)}
              fullWidth
              size="small"
              placeholder="https://spviewer.eu/..."
            />

            {/* Sharing: Organizations & Federations */}
            {(userOrganizations.length > 0 || userFederations.length > 0) && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Share with Organizations &amp; Federations
                </Typography>
                <List
                  dense
                  sx={{
                    bgcolor: 'background.default',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {userOrganizations.map(org => (
                    <ListItem key={org.id} disablePadding>
                      <ListItemButton onClick={() => handleToggleShareTarget(org.id)} dense>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Checkbox
                            edge="start"
                            checked={editSharedOrgs.includes(org.id)}
                            disableRipple
                            size="small"
                          />
                        </ListItemIcon>
                        <ListItemText primary={org.name} secondary="Organization" />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  {userFederations.map(fed => (
                    <ListItem key={fed.id} disablePadding>
                      <ListItemButton onClick={() => handleToggleShareTarget(fed.id)} dense>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Checkbox
                            edge="start"
                            checked={editSharedOrgs.includes(fed.id)}
                            disableRipple
                            size="small"
                          />
                        </ListItemIcon>
                        <ListItemText primary={fed.name} secondary="Federation" />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseEdit} disabled={updateLoadout.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={updateLoadout.isPending || editName.trim().length < 2}
          >
            {updateLoadout.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export const SharedResourcesManagerWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Shared Resources">
    <SharedResourcesManager />
  </FeatureErrorBoundary>
);
