import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';

import { useCrewAssignmentsQuery } from '@/hooks/queries/useCrewQueries';
import { useOrgShips } from '@/hooks/queries/useOrgShipQueries';
import { apiClient } from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';

interface OrgShip {
  id: string;
  shipName?: string;
  customName?: string;
}

interface CrewManifestEntry {
  userId: string;
  username: string;
  roles: string[];
  ships: string[];
}

const toOrgShips = (value: unknown): OrgShip[] => {
  if (Array.isArray(value)) {
    return value as OrgShip[];
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as OrgShip[];
    }
  }

  return [];
};

export const CrewManifestPanel: React.FC = () => {
  const orgId = useAuthStore(state => state.user?.activeOrgId) ?? '';
  const {
    data: assignmentsResponse,
    isLoading,
    error,
    refetch,
  } = useCrewAssignmentsQuery({ page: 1, limit: 200 });
  const { data: shipsResponse } = useOrgShips(orgId);
  const [createOpen, setCreateOpen] = useState(false);
  const [newShipId, setNewShipId] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const shipNameById = useMemo(() => {
    const ships = toOrgShips(shipsResponse);
    return new Map(
      ships.map(ship => [
        ship.id,
        ship.customName || ship.shipName || `Ship ${ship.id.slice(0, 8)}`,
      ])
    );
  }, [shipsResponse]);

  const manifest = useMemo<CrewManifestEntry[]>(() => {
    const assignments = assignmentsResponse?.data || [];
    const manifestMap = new Map<string, CrewManifestEntry>();

    for (const assignment of assignments) {
      const shipId = assignment.shipId;
      const shipLabel = shipNameById.get(shipId) || `Ship ${shipId.slice(0, 8)}`;

      for (const member of assignment.crew || []) {
        const existing = manifestMap.get(member.userId);
        if (existing) {
          if (!existing.roles.includes(member.role)) {
            existing.roles.push(member.role);
          }
          if (!existing.ships.includes(shipLabel)) {
            existing.ships.push(shipLabel);
          }
          continue;
        }

        manifestMap.set(member.userId, {
          userId: member.userId,
          username: member.username || member.userId.slice(0, 8),
          roles: [member.role],
          ships: [shipLabel],
        });
      }
    }

    return Array.from(manifestMap.values()).sort((a, b) => a.username.localeCompare(b.username));
  }, [assignmentsResponse, shipNameById]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load crew manifest.</Alert>;
  }

  const handleCreateAssignment = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      await apiClient.post('/api/v2/crew-assignments', {
        shipId: newShipId.trim(),
        crew: [{ userId: newUserId.trim(), role: newRole.trim() }],
      });
      setCreateOpen(false);
      setNewShipId('');
      setNewUserId('');
      setNewRole('');
      void refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create assignment';
      setCreateError(message);
      logger.error(
        'Failed to create crew assignment',
        err instanceof Error ? err : new Error(String(err))
      );
    } finally {
      setCreating(false);
    }
  };

  const orgShips = toOrgShips(shipsResponse);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">Crew Manifest</Typography>
              <Typography variant="body2" color="text.secondary">
                Fleet-wide crew assignments grouped by member.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
            >
              Assign Crew
            </Button>
          </Stack>

          {/* Create Assignment Dialog */}
          <Dialog
            open={createOpen}
            onClose={() => !creating && setCreateOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Assign Crew to Ship</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {createError && <Alert severity="error">{createError}</Alert>}
                <TextField
                  label="Ship"
                  select
                  value={newShipId}
                  onChange={e => setNewShipId(e.target.value)}
                  fullWidth
                  size="small"
                  SelectProps={{ native: true }}
                >
                  <option value="">Select a ship...</option>
                  {orgShips.map(ship => (
                    <option key={ship.id} value={ship.id}>
                      {ship.customName || ship.shipName || ship.id.slice(0, 8)}
                    </option>
                  ))}
                </TextField>
                <TextField
                  label="User ID"
                  value={newUserId}
                  onChange={e => setNewUserId(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Enter crew member's user ID"
                />
                <TextField
                  label="Role"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="e.g., Pilot, Gunner, Engineer"
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateAssignment}
                disabled={creating || !newShipId || !newUserId.trim() || !newRole.trim()}
              >
                {creating ? 'Assigning...' : 'Assign'}
              </Button>
            </DialogActions>
          </Dialog>

          {manifest.length === 0 ? (
            <Alert severity="info">No crew assignments found yet.</Alert>
          ) : (
            manifest.map(entry => (
              <Box
                key={entry.userId}
                sx={{ borderBottom: theme => `1px solid ${theme.palette.divider}`, pb: 2 }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {entry.username}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
                  {entry.roles.map(role => (
                    <Chip
                      key={`${entry.userId}-${role}`}
                      label={role}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Assigned ships: {entry.ships.join(', ')}
                </Typography>
              </Box>
            ))
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
