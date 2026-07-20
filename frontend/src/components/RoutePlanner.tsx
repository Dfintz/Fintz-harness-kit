import { activityServiceV2 } from '@/services/activityServiceV2';
import type { Activity, RouteWaypoint } from '@/types/activity';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import LocationIcon from '@mui/icons-material/LocationOn';
import RouteIcon from '@mui/icons-material/Route';
import { Box, Button, Grid, IconButton, Stack, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { ErrorMessage } from './ErrorMessage';

interface RoutePlannerProps {
  activity: Activity;
  onUpdate: () => void;
}

export const RoutePlanner: React.FC<RoutePlannerProps> = ({ activity, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddWaypoint, setShowAddWaypoint] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState<number | null>(null);

  const [waypointForm, setWaypointForm] = useState<Partial<RouteWaypoint>>({
    location: '',
    system: '',
    coordinates: '',
    distance: 0,
    estimatedTravelTime: 0,
    activities: [],
    requiredFuel: 0,
    notes: '',
  });

  const handleAddRoute = async () => {
    try {
      setError('');
      setLoading(true);

      const waypoints: RouteWaypoint[] = [
        {
          order: 1,
          location: waypointForm.location || '',
          system: waypointForm.system || '',
          coordinates: waypointForm.coordinates,
          distance: waypointForm.distance,
          estimatedTravelTime: waypointForm.estimatedTravelTime,
          activities: waypointForm.activities,
          requiredFuel: waypointForm.requiredFuel,
          notes: waypointForm.notes,
        },
      ];

      await activityServiceV2.addRoutePlan(activity.id, waypoints);
      setShowAddWaypoint(false);
      resetForm();
      onUpdate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add route');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWaypoint = async (waypointOrder: number) => {
    try {
      setError('');
      setLoading(true);

      await activityServiceV2.updateWaypoint(activity.id, waypointOrder, waypointForm);
      setEditingWaypoint(null);
      resetForm();
      onUpdate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update waypoint');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setWaypointForm({
      location: '',
      system: '',
      coordinates: '',
      distance: 0,
      estimatedTravelTime: 0,
      activities: [],
      requiredFuel: 0,
      notes: '',
    });
  };

  const startEditWaypoint = (waypoint: RouteWaypoint) => {
    setEditingWaypoint(waypoint.order);
    setWaypointForm({ ...waypoint });
  };

  const formatDistance = (distance?: number): string => {
    if (!distance) return 'N/A';
    if (distance >= 1000000) return `${(distance / 1000000).toFixed(1)}M km`;
    if (distance >= 1000) return `${(distance / 1000).toFixed(1)}K km`;
    return `${distance.toFixed(0)} km`;
  };

  const formatTime = (minutes?: number): string => {
    if (!minutes) return 'N/A';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
  };

  return (
    <Box>
      <Stack direction="column" spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <LocationIcon fontSize="medium" />
            <Typography variant="h6">Route Planning</Typography>
          </Stack>
          <Button
            variant="contained"
            onClick={() => setShowAddWaypoint(!showAddWaypoint)}
            disabled={loading}
          >
            <AddIcon fontSize="small" />
            <Typography>Add Waypoint</Typography>
          </Button>
        </Stack>

        {error && <ErrorMessage message={error} />}

        {/* Add/Edit Waypoint Form */}
        {(showAddWaypoint || editingWaypoint !== null) && (
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Stack direction="column" spacing={2}>
              <Typography variant="subtitle1">
                {editingWaypoint !== null ? 'Edit Waypoint' : 'Add Waypoint'}
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Location"
                    placeholder="e.g., Aaron Halo"
                    value={waypointForm.location}
                    onChange={e => setWaypointForm({ ...waypointForm, location: e.target.value })}
                    required
                    fullWidth
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="System"
                    placeholder="e.g., Stanton"
                    value={waypointForm.system}
                    onChange={e => setWaypointForm({ ...waypointForm, system: e.target.value })}
                    required
                    fullWidth
                  />
                </Grid>
              </Grid>

              <TextField
                label="Coordinates (optional)"
                placeholder="e.g., X:1234, Y:5678, Z:9012"
                value={waypointForm.coordinates}
                onChange={e => setWaypointForm({ ...waypointForm, coordinates: e.target.value })}
                fullWidth
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Distance (km)"
                    type="number"
                    value={waypointForm.distance?.toString() || '0'}
                    onChange={e =>
                      setWaypointForm({
                        ...waypointForm,
                        distance: parseFloat(e.target.value) || 0,
                      })
                    }
                    fullWidth
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Travel Time (min)"
                    type="number"
                    value={waypointForm.estimatedTravelTime?.toString() || '0'}
                    onChange={e =>
                      setWaypointForm({
                        ...waypointForm,
                        estimatedTravelTime: parseInt(e.target.value) || 0,
                      })
                    }
                    fullWidth
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Required Fuel"
                    type="number"
                    value={waypointForm.requiredFuel?.toString() || '0'}
                    onChange={e =>
                      setWaypointForm({
                        ...waypointForm,
                        requiredFuel: parseFloat(e.target.value) || 0,
                      })
                    }
                    fullWidth
                  />
                </Grid>
              </Grid>

              <TextField
                label="Notes"
                placeholder="Any special notes about this waypoint..."
                value={waypointForm.notes}
                onChange={e => setWaypointForm({ ...waypointForm, notes: e.target.value })}
                multiline
                rows={3}
                fullWidth
              />

              <Stack direction="row" spacing={2}>
                {editingWaypoint !== null ? (
                  <Button
                    variant="contained"
                    onClick={() => handleUpdateWaypoint(editingWaypoint)}
                    disabled={loading}
                  >
                    Update Waypoint
                  </Button>
                ) : (
                  <Button variant="contained" onClick={handleAddRoute} disabled={loading}>
                    Add Waypoint
                  </Button>
                )}
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowAddWaypoint(false);
                    setEditingWaypoint(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}

        {/* Route Display */}
        {activity.routePlan && activity.routePlan.length > 0 ? (
          <Box>
            <Typography variant="subtitle1" mb={2}>
              Route Waypoints
            </Typography>

            {/* Summary Stats */}
            {(activity.totalDistance || activity.totalEstimatedTime) && (
              <Box sx={{ borderRadius: 1, p: 2, mb: 2 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 2,
                  }}
                >
                  {activity.totalDistance && (
                    <div>
                      <Typography sx={{ fontSize: '0.9em', color: 'text.secondary' }}>
                        Total Distance
                      </Typography>
                      <Typography variant="subtitle1">
                        {formatDistance(activity.totalDistance)}
                      </Typography>
                    </div>
                  )}
                  {activity.totalEstimatedTime && (
                    <div>
                      <Typography sx={{ fontSize: '0.9em', color: 'text.secondary' }}>
                        Total Travel Time
                      </Typography>
                      <Typography variant="subtitle1">
                        {formatTime(activity.totalEstimatedTime)}
                      </Typography>
                    </div>
                  )}
                  <div>
                    <Typography sx={{ fontSize: '0.9em', color: 'text.secondary' }}>
                      Waypoints
                    </Typography>
                    <Typography variant="subtitle1">{activity.routePlan.length}</Typography>
                  </div>
                </Box>
              </Box>
            )}

            {/* Waypoint List */}
            <Stack direction="column" spacing={2}>
              {activity.routePlan
                .sort((a, b) => a.order - b.order)
                .map((waypoint: RouteWaypoint, index: number) => (
                  <Box key={index} sx={{ borderRadius: 1, p: 2 }}>
                    <Stack direction="column" spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{ backgroundColor: 'info.main', textAlign: 'center' }}
                            p={1}
                            borderRadius="medium"
                            width="size-400"
                          >
                            <Typography sx={{ color: 'common.white', fontWeight: 'bold' }}>
                              {waypoint.order}
                            </Typography>
                          </Box>
                          <div>
                            <Typography variant="body1">{waypoint.location}</Typography>
                            <Typography sx={{ fontSize: '0.9em', color: 'text.secondary' }}>
                              {waypoint.system}
                            </Typography>
                          </div>
                        </Stack>
                        <IconButton
                          onClick={() => startEditWaypoint(waypoint)}
                          aria-label="Edit waypoint"
                        >
                          <EditIcon />
                        </IconButton>
                      </Stack>

                      {waypoint.coordinates && (
                        <Typography sx={{ fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocationIcon fontSize="small" /> {waypoint.coordinates}
                        </Typography>
                      )}

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: 1.5,
                        }}
                      >
                        {waypoint.distance !== undefined && waypoint.distance > 0 && (
                          <Typography sx={{ fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <RouteIcon sx={{ fontSize: 16 }} /> {formatDistance(waypoint.distance)}
                          </Typography>
                        )}
                        {waypoint.estimatedTravelTime !== undefined &&
                          waypoint.estimatedTravelTime > 0 && (
                            <Typography sx={{ fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <AccessTimeIcon sx={{ fontSize: 16 }} /> {formatTime(waypoint.estimatedTravelTime)}
                            </Typography>
                          )}
                        {waypoint.requiredFuel !== undefined && waypoint.requiredFuel > 0 && (
                          <Typography sx={{ fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocalGasStationIcon sx={{ fontSize: 16 }} /> {waypoint.requiredFuel} fuel
                          </Typography>
                        )}
                      </Box>

                      {waypoint.notes && (
                        <Box p={1} borderRadius="small" sx={{ backgroundColor: 'action.hover' }}>
                          <Typography sx={{ fontSize: '0.9em' }}>{waypoint.notes}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                ))}
            </Stack>
          </Box>
        ) : (
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography>No route plan yet. Add waypoints to create a route!</Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
};
