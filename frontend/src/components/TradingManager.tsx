import { tradingServiceV2 } from '@/services/tradingServiceV2';
import { useAuthStore } from '@/store/authStore';
import type { FleetShip, TradeStop } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import {
  Add,
  Delete as DeleteIcon,
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { EmptyState } from './EmptyState';
import { PageHeader } from './PageHeader';
import { IconButton, NumberField, TypographyField, Well } from './ui';

// Import from extracted utilities
import {
  calculateFleetComposition,
  calculateRefuelingStops,
  PRICE_ESTIMATION,
  transformOpportunityToDisplay,
  transformRouteToDisplay,
  type OpportunityDisplay,
  type RouteDisplay,
  type RouteStop,
} from './trading';

/**
 * TradingManager Component
 *
 * Comprehensive trading route management with fleet-aware routing.
 *
 * Features:
 * - Load/display trading routes from backend API
 * - Search for profitable trade opportunities
 * - Route optimization by profit per hour
 * - Create routes with dynamic stop management
 * - Fleet composition tracking and optimization
 * - Automatic refueling stop calculation
 *
 * @component
 */

export const TradingManager: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [routes, setRoutes] = useState<RouteDisplay[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('routes');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteDisplay | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Opportunity finder state
  const [startLocation, setStartLocation] = useState('');
  const [minProfitMargin, setMinProfitMargin] = useState(15);

  // Route creation/editing state
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [routeStops, setRouteStops] = useState<RouteStop[]>([
    { location: '', buyGoods: '', sellGoods: '', order: 0, type: 'trade', distance: '' },
  ]);

  // Fleet composition state
  const [fleetShips, setFleetShips] = useState<Array<FleetShip>>([]);
  const [showFleetDialog, setShowFleetDialog] = useState(false);

  useEffect(() => {
    if (user?.organizationId) {
      loadRoutes();
    }
  }, [user?.organizationId]);

  /**
   * Load trading routes for the user's organization from backend API
   *
   * Fetches routes via tradingServiceV2.getRoutes() and transforms them
   * into RouteDisplay format for table rendering.
   *
   * Tracked: F-12 (pagination + status/profit filtering) — see docs/SPRINT_ROADMAP.md
   */
  const loadRoutes = async () => {
    if (!user?.organizationId) {
      setRoutes([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await tradingServiceV2.getRoutes(user.organizationId, {
        limit: 100,
      });

      // Transform API data to display format using extracted utility
      const displayRoutes = result.items.map(transformRouteToDisplay);
      setRoutes(displayRoutes);
    } catch (error) {
      logger.error(
        'Failed to load routes:',
        error instanceof Error ? error : new Error(String(error))
      );
      setError('Failed to load routes');
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Search for profitable trading opportunities based on user criteria
   *
   * Converts profit margin percentage to absolute profit value and queries
   * the opportunities endpoint. Results are transformed for display.
   *
   * Tracked: F-12 (start-location + cargo-capacity filtering) — see docs/SPRINT_ROADMAP.md
   */
  const findOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      // Convert profit margin percentage to estimated profit value
      const minProfit =
        minProfitMargin > 0
          ? Math.floor(minProfitMargin * PRICE_ESTIMATION.PROFIT_CONVERSION_FACTOR)
          : 0;

      const result = await tradingServiceV2.getOpportunities({
        minProfit,
        limit: 20,
      });

      // Transform opportunities to display format using extracted utility
      const apiOpportunities = (result as any).opportunities || [];
      const displayOpps = apiOpportunities.map(transformOpportunityToDisplay);
      setOpportunities(displayOpps);
    } catch (error) {
      logger.error(
        'Failed to find opportunities:',
        error instanceof Error ? error : new Error(String(error))
      );
      setError('Failed to find opportunities');
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Optimize route by finding best opportunities sorted by profit per hour
   *
   * Similar to findOpportunities but sorts by profitPerHour for time efficiency
   * and automatically switches to opportunities tab to show results.
   *
   * Tracked: F-13 (multi-objective optimizer using fleet composition, inter-stop
   * distances, and origin-anchored pathfinding from startLocation) — see
   * docs/SPRINT_ROADMAP.md
   */
  const optimizeRoute = async () => {
    if (!startLocation) {
      setError('Please enter a start location');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Optimize route by finding best opportunities sorted by profit per hour
      const minProfit = Math.floor(minProfitMargin * PRICE_ESTIMATION.PROFIT_CONVERSION_FACTOR);

      const result = await tradingServiceV2.getOpportunities({
        minProfit,
        limit: 10,
      });

      // Sort opportunities by profitPerHour for route optimization
      const sortedOpps = [...(result.opportunities || [])].sort(
        (a, b) => ((b.profitPerHour as number) || 0) - ((a.profitPerHour as number) || 0)
      );

      // Transform to display format using extracted utility
      const displayOpps = sortedOpps.map(transformOpportunityToDisplay);

      setOpportunities(displayOpps);
      setSelectedTab('opportunities');
    } catch (error) {
      logger.error(
        'Failed to optimize route:',
        error instanceof Error ? error : new Error(String(error))
      );
      setError('Failed to optimize route');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add a new stop to the route
   * Initializes with default values and increments order
   */
  const addStop = () => {
    setRouteStops([
      ...routeStops,
      {
        location: '',
        buyGoods: '',
        sellGoods: '',
        order: routeStops.length,
        type: 'trade',
        distance: '',
      },
    ]);
  };

  /**
   * Remove a stop from the route
   * Maintains at least 1 stop and reorders remaining stops
   *
   * @param index - Index of stop to remove
   */
  const removeStop = (index: number) => {
    if (routeStops.length > 1) {
      const updated = routeStops
        .filter((_, i) => i !== index)
        .map((stop, i) => ({ ...stop, order: i }));
      setRouteStops(updated);
    }
  };

  /**
   * Update a field on a specific stop
   *
   * @param index - Index of stop to update
   * @param field - Field name to update
   * @param value - New value for the field
   */
  const updateStop = (index: number, field: keyof RouteStop, value: string) => {
    const updated = [...routeStops];
    if (field === 'type') {
      updated[index] = { ...updated[index], [field]: value as 'trade' | 'refuel' | 'waypoint' };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setRouteStops(updated);
  };

  /**
   * Add a new ship to the fleet composition
   * Initializes with default values
   *
   * Tracked: F-14 (auto-populate cargo / speed / quantum specs from ShipService
   * once a ship is selected) — see docs/SPRINT_ROADMAP.md
   */
  const addFleetShip = () => {
    setFleetShips([
      ...fleetShips,
      {
        shipId: '',
        shipName: '',
        quantity: 1,
        cargo: 0,
        speed: 0,
        quantumSpeed: 0,
        quantumFuelCapacity: 0,
        isRefuelingShip: false,
      },
    ]);
  };

  /**
   * Remove a ship from the fleet composition
   *
   * @param index - Index of ship to remove
   */
  const removeFleetShip = (index: number) => {
    setFleetShips(fleetShips.filter((_, i) => i !== index));
  };

  /**
   * Update a field on a specific fleet ship
   *
   * @param index - Index of ship to update
   * @param field - Field name to update
   * @param value - New value for the field
   */
  const updateFleetShip = (index: number, field: keyof FleetShip, value: unknown) => {
    const updated = [...fleetShips];
    updated[index] = { ...updated[index], [field]: value };
    setFleetShips(updated);
  };

  /**
   * Save a new trading route to the backend
   *
   * Validates route data, calculates refueling stops if needed, and sends
   * to API. On success, reloads routes and closes dialog.
   *
   * Tracked: F-15 (edit existing routes; validate aggregate cargo ≤ fleet
   * capacity; validate quantum-fuel demand fits fleet capacity) — see
   * docs/SPRINT_ROADMAP.md
   *
   * @returns Promise that resolves when route is saved
   */
  const saveRoute = async () => {
    if (!user?.organizationId || !routeName) {
      setError('Please enter a route name');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Calculate refueling stops if needed using extracted utility
      const finalStops = calculateRefuelingStops(routeStops, fleetShips);

      // Transform stops to API format
      const apiStops: TradeStop[] = finalStops
        .filter(stop => stop.location) // Only include stops with locations
        .map((stop, idx) => ({
          location: stop.location,
          buyGoods: stop.buyGoods ? stop.buyGoods.split(',').map(g => g.trim()) : undefined,
          sellGoods: stop.sellGoods ? stop.sellGoods.split(',').map(g => g.trim()) : undefined,
          order: idx,
          type: stop.type,
          distance: parseFloat(stop.distance) || undefined,
          requiredFuel: stop.distance ? parseFloat(stop.distance) * 0.1 : undefined, // Simplified calc
        }));

      if (apiStops.length === 0) {
        setError('Please add at least one stop with a location');
        setLoading(false);
        return;
      }

      await tradingServiceV2.createRoute(user.organizationId, {
        name: routeName,
        description: routeDescription,
        stops: apiStops,
      });

      await loadRoutes();
      setShowCreateDialog(false);
      resetRouteForm();
    } catch (error) {
      logger.error(
        'Failed to save route:',
        error instanceof Error ? error : new Error(String(error))
      );
      setError('Failed to save route');
    } finally {
      setLoading(false);
    }
  };

  const resetRouteForm = () => {
    setRouteName('');
    setRouteDescription('');
    setRouteStops([
      { location: '', buyGoods: '', sellGoods: '', order: 0, type: 'trade', distance: '' },
    ]);
    setFleetShips([]);
    setSelectedRoute(null);
  };

  const openCreateDialog = () => {
    resetRouteForm();
    setShowCreateDialog(true);
  };

  return (
    <Stack direction="column" spacing={3} width="100%">
      {/* Header */}
      <PageHeader
        title="Trading & Routes"
        description="Discover profitable trading opportunities and manage routes"
        primaryAction={{
          label: 'Create Route',
          icon: Add,
          onPress: openCreateDialog,
        }}
      />

      {/* Error Display */}
      {error && (
        <Box sx={{ backgroundColor: 'error.main', p: 2, borderRadius: 1 }}>
          <Typography sx={{ color: 'white' }}>{error}</Typography>
        </Box>
      )}

      {/* Opportunity Finder */}
      <Well>
        <Box
          sx={{
            background: theme.palette.background.default,
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <Typography variant="h6" mb={2}>
            Find Trade Opportunities
          </Typography>

          <Stack direction="row" spacing={2} alignItems="end" sx={{ flexWrap: 'wrap' }}>
            <TypographyField
              label="Start Location"
              placeholder="Port Olisar"
              value={startLocation}
              onChange={setStartLocation}
              width="size-3000"
            />
            <NumberField
              label="Min Profit Margin %"
              value={minProfitMargin}
              onChange={setMinProfitMargin}
              minValue={0}
              maxValue={100}
              width="size-2000"
            />
            <Button variant="contained" onClick={findOpportunities} disabled={loading}>
              <TrendingUpIcon />
              <Typography>Find Opportunities</Typography>
            </Button>
            <Button variant="outlined" onClick={optimizeRoute} disabled={!startLocation || loading}>
              <Typography>Optimize Route</Typography>
            </Button>
          </Stack>
        </Box>
      </Well>

      {/* Tabs */}
      <Tabs value={selectedTab} onChange={(_e, newValue) => setSelectedTab(newValue)}>
        <Tab label={`My Routes (${routes.length})`} value="routes" />
        <Tab label={`Opportunities (${opportunities.length})`} value="opportunities" />
      </Tabs>
      <Box sx={{ mt: 2 }}>
        {/* My Routes Tab */}
        {selectedTab === 'routes' && (
          <>
            {routes.length === 0 ? (
              <EmptyState
                title="No trading routes yet"
                description="Create your first trading route to start optimizing your profits"
                actionLabel="Create First Route"
                onAction={openCreateDialog}
              />
            ) : (
              <Well>
                <Box
                  sx={{
                    background: theme.palette.background.default,
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <TableContainer>
                    <Table aria-label="Trading routes" size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Route Name</TableCell>
                          <TableCell align="right">Stops</TableCell>
                          <TableCell align="right">Est. Profit</TableCell>
                          <TableCell align="right">Duration</TableCell>
                          <TableCell align="right">Runs</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {routes.map(route => (
                          <TableRow key={route.id} hover>
                            <TableCell>
                              <Stack direction="column">
                                <Typography sx={{ fontWeight: 'bold' }}>{route.name}</Typography>
                                <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                                  {route.description}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell align="right">{route.stops}</TableCell>
                            <TableCell align="right">
                              <Typography sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                {route.estimatedProfit.toLocaleString()} aUEC
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{route.duration} min</TableCell>
                            <TableCell align="right">{route.runCount}</TableCell>
                            <TableCell>
                              <Chip
                                label={route.status}
                                size="small"
                                sx={getStatusChipSx(route.status, theme)}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Stack spacing={1} direction="row" justifyContent="flex-end">
                                <IconButton
                                  onClick={() => setSelectedRoute(route)}
                                  size="sm"
                                  aria-label="Box details"
                                >
                                  <TrendingUpIcon />
                                </IconButton>
                                <IconButton
                                  onClick={() => {
                                    setSelectedRoute(route);
                                    setShowCreateDialog(true);
                                  }}
                                  size="sm"
                                  aria-label="Edit route"
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton size="sm" aria-label="Delete route">
                                  <DeleteIcon />
                                </IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Well>
            )}
          </>
        )}

        {/* Opportunities Tab */}
        {selectedTab === 'opportunities' && (
          <>
            {opportunities.length === 0 ? (
              <EmptyState
                title="Find trade opportunities"
                description="Enter a start location above to discover profitable trades"
              />
            ) : (
              <Well>
                <Box
                  sx={{
                    background: theme.palette.background.default,
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <Typography variant="h6" mb={2}>
                    Profitable Opportunities
                  </Typography>

                  <TableContainer>
                    <Table aria-label="Trade opportunities" size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Commodity</TableCell>
                          <TableCell>Buy From</TableCell>
                          <TableCell align="right">Buy Price</TableCell>
                          <TableCell>Sell To</TableCell>
                          <TableCell align="right">Sell Price</TableCell>
                          <TableCell align="right">Profit/Unit</TableCell>
                          <TableCell align="right">Margin</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {opportunities.map((opp, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>
                              <Typography sx={{ fontWeight: 'bold' }}>{opp.commodity}</Typography>
                            </TableCell>
                            <TableCell>{opp.buyLocation}</TableCell>
                            <TableCell align="right">
                              <Typography sx={{ color: 'error.light' }}>
                                {opp.buyPrice.toFixed(2)} aUEC
                              </Typography>
                            </TableCell>
                            <TableCell>{opp.sellLocation}</TableCell>
                            <TableCell align="right">
                              <Typography sx={{ color: 'success.light' }}>
                                {opp.sellPrice.toFixed(2)} aUEC
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                {opp.profitPerUnit.toFixed(2)} aUEC
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="column" spacing={0.5} sx={{ minWidth: '150px' }}>
                                <Box sx={{ width: '100%' }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={opp.profitMargin}
                                    aria-label={`${opp.profitMargin.toFixed(1)}% profit margin`}
                                  />
                                </Box>
                                <Typography
                                  sx={{
                                    fontSize: '0.875rem',
                                    color: 'success.main',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {opp.profitMargin.toFixed(1)}%
                                </Typography>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Well>
            )}
          </>
        )}
      </Box>

      {/* Create/Edit Route Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{selectedRoute ? 'Edit' : 'Create'} Trading Route</DialogTitle>
        <DialogContent>
          <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Route Name"
              required
              value={routeName}
              onChange={e => setRouteName(e.target.value)}
              placeholder="Olisar to Lorville Loop"
              fullWidth
            />

            <TextField
              label="Description"
              value={routeDescription}
              onChange={e => setRouteDescription(e.target.value)}
              placeholder="Quick medical supplies run"
              fullWidth
            />

            <Typography variant="subtitle1">Route Stops</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              Add locations and commodities for each stop
            </Typography>

            {/* Dynamic Stop Management */}
            {routeStops.map((stop, index) => (
              <Box
                key={index}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '4px',
                  p: 2,
                  background: theme.palette.background.default,
                }}
              >
                <Stack direction="column" spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1">Stop {index + 1}</Typography>
                      <Chip
                        label={stop.type}
                        size="small"
                        color={
                          stop.type === 'refuel'
                            ? 'info'
                            : stop.type === 'waypoint'
                              ? 'default'
                              : 'success'
                        }
                        variant="outlined"
                      />
                    </Stack>
                    {routeStops.length > 1 && (
                      <Button
                        size="small"
                        onClick={() => removeStop(index)}
                        sx={{ color: 'error.main' }}
                        title="Remove stop"
                      >
                        Remove
                      </Button>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    <TextField
                      label="Location"
                      value={stop.location}
                      onChange={e => updateStop(index, 'location', e.target.value)}
                      placeholder="Port Olisar"
                      required
                      sx={{ minWidth: '200px', flex: 1 }}
                    />
                    <FormControl sx={{ minWidth: '150px', flex: 1 }}>
                      <InputLabel>Stop Type</InputLabel>
                      <Select
                        value={stop.type}
                        onChange={e => updateStop(index, 'type', e.target.value)}
                        label="Stop Type"
                      >
                        <MenuItem value="trade">Trade</MenuItem>
                        <MenuItem value="refuel">Refuel</MenuItem>
                        <MenuItem value="waypoint">Waypoint</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="Distance (km)"
                      value={stop.distance}
                      onChange={e => updateStop(index, 'distance', e.target.value)}
                      placeholder="1000"
                      type="number"
                      sx={{ minWidth: '150px', flex: 1 }}
                    />
                  </Stack>
                  {stop.type === 'trade' && (
                    <>
                      <TextField
                        label="Buy Goods (comma separated)"
                        value={stop.buyGoods}
                        onChange={e => updateStop(index, 'buyGoods', e.target.value)}
                        placeholder="Medical Supplies, Food"
                        fullWidth
                      />
                      <TextField
                        label="Sell Goods (comma separated)"
                        value={stop.sellGoods}
                        onChange={e => updateStop(index, 'sellGoods', e.target.value)}
                        placeholder="Scrap, Ore"
                        fullWidth
                      />
                    </>
                  )}
                </Stack>
              </Box>
            ))}

            <Button variant="outlined" onClick={addStop}>
              Add Stop
            </Button>

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1">Fleet Composition</Typography>
              <Button variant="outlined" onClick={() => setShowFleetDialog(true)}>
                Configure Fleet ({fleetShips.length} ships)
              </Button>
            </Stack>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              {fleetShips.length > 0 ? (
                <>
                  Total Cargo: {calculateFleetComposition(fleetShips)?.totalCargo || 0} SCU |
                  {calculateFleetComposition(fleetShips)?.hasRefuelingShip && ' Has Refueling Ship'}
                </>
              ) : (
                'Add ships to optimize route for fleet capabilities'
              )}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShowCreateDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveRoute} disabled={loading || !routeName}>
            {selectedRoute ? 'Update' : 'Create'} Route
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fleet Configuration Dialog */}
      <Dialog
        open={showFleetDialog}
        onClose={() => setShowFleetDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Configure Fleet</DialogTitle>
        <DialogContent>
          <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
            <Typography>
              Add ships to your fleet to calculate optimal routes considering speed, fuel, and cargo
              capacity.
            </Typography>

            {fleetShips.map((ship, index) => (
              <Box
                key={index}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '4px',
                  p: 2,
                  background: theme.palette.background.default,
                }}
              >
                <Stack direction="column" spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1">Ship {index + 1}</Typography>
                    <Button
                      size="small"
                      onClick={() => removeFleetShip(index)}
                      sx={{ color: 'error.main' }}
                      title="Remove ship"
                    >
                      Remove
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    <TextField
                      label="Ship Name"
                      value={ship.shipName}
                      onChange={e => updateFleetShip(index, 'shipName', e.target.value)}
                      placeholder="Constellation Andromeda"
                      required
                      sx={{ minWidth: '200px', flex: 1 }}
                    />
                    <TextField
                      label="Quantity"
                      type="number"
                      value={ship.quantity}
                      onChange={e =>
                        updateFleetShip(index, 'quantity', parseInt(e.target.value) || 1)
                      }
                      inputProps={{ min: 1 }}
                      sx={{ minWidth: '120px', flex: 1 }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    <TextField
                      label="Cargo (SCU)"
                      type="number"
                      value={ship.cargo || 0}
                      onChange={e => updateFleetShip(index, 'cargo', parseInt(e.target.value) || 0)}
                      inputProps={{ min: 0 }}
                      sx={{ minWidth: '150px', flex: 1 }}
                    />
                    <TextField
                      label="Speed (m/s)"
                      type="number"
                      value={ship.speed || 0}
                      onChange={e => updateFleetShip(index, 'speed', parseInt(e.target.value) || 0)}
                      inputProps={{ min: 0 }}
                      sx={{ minWidth: '150px', flex: 1 }}
                    />
                    <TextField
                      label="Q-Speed (km/s)"
                      type="number"
                      value={ship.quantumSpeed || 0}
                      onChange={e =>
                        updateFleetShip(index, 'quantumSpeed', parseInt(e.target.value) || 0)
                      }
                      inputProps={{ min: 0 }}
                      sx={{ minWidth: '150px', flex: 1 }}
                    />
                    <TextField
                      label="Q-Fuel"
                      type="number"
                      value={ship.quantumFuelCapacity || 0}
                      onChange={e =>
                        updateFleetShip(index, 'quantumFuelCapacity', parseInt(e.target.value) || 0)
                      }
                      inputProps={{ min: 0 }}
                      sx={{ minWidth: '150px', flex: 1 }}
                    />
                  </Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={ship.isRefuelingShip || false}
                        onChange={e => updateFleetShip(index, 'isRefuelingShip', e.target.checked)}
                      />
                    }
                    label="Refueling Ship (Starfarer, etc.)"
                  />
                </Stack>
              </Box>
            ))}

            <Button variant="outlined" onClick={addFleetShip}>
              Add Ship
            </Button>

            {fleetShips.length > 0 && (
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'success.dark',
                  borderRadius: '4px',
                  p: 2,
                  background: alpha(theme.palette.success.main, 0.1),
                }}
              >
                <Typography variant="body1" mb={1}>
                  Fleet Summary
                </Typography>
                <Stack direction="column" spacing={0.5}>
                  <Typography>
                    Total Ships: {fleetShips.reduce((sum, s) => sum + s.quantity, 0)}
                  </Typography>
                  <Typography>
                    Total Cargo Capacity: {calculateFleetComposition(fleetShips)?.totalCargo || 0}{' '}
                    SCU
                  </Typography>
                  <Typography>
                    Slowest Speed: {calculateFleetComposition(fleetShips)?.slowestSpeed || 0} m/s
                  </Typography>
                  <Typography>
                    Slowest Quantum Speed:{' '}
                    {calculateFleetComposition(fleetShips)?.slowestQuantumSpeed || 0} km/s
                  </Typography>
                  <Typography>
                    Min Fuel Capacity: {calculateFleetComposition(fleetShips)?.minFuelCapacity || 0}
                  </Typography>
                  {calculateFleetComposition(fleetShips)?.hasRefuelingShip && (
                    <Typography sx={{ color: 'success.main', fontWeight: 'bold' }}>
                      ✓ Has Refueling Ship (No refuel stops needed)
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setShowFleetDialog(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
