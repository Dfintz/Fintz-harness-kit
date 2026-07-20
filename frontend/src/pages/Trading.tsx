import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useCreatePriceAlert,
  useCreateTradingRoute,
  useDeletePriceAlert,
  useDeleteTradingRoute,
  usePriceAlerts,
  useTradingOpportunities,
  useTradingRoutes,
  useUexCommodities,
  useUexRoutes,
  useUexTerminals,
  useUpdatePriceAlert,
} from '@/hooks/queries/useTradingQueries';
import type {
  CreatePriceAlertInput,
  PriceAlertCondition,
  UEXRouteSearchParams,
  UEXTradeRoute,
} from '@/services/tradingServiceV2';
import { useAuthStore } from '@/store/authStore';
import { TradeStop } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import {
  Add,
  Delete,
  Edit,
  LocationOn,
  Notifications,
  Search,
  TrendingUp,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import React, { useState } from 'react';

const getMarginColor = (margin: number, theme: Theme) => {
  if (margin > 20) return theme.palette.success.dark;
  if (margin > 10) return theme.palette.warning.dark;
  return theme.palette.grey[700];
};

export const Trading: React.FC = () => {
  const theme = useTheme();
  const user = useAuthStore(state => state.user);
  const organizationId = user?.organizationId || '';

  const [activeTab, setActiveTab] = useState('opportunities');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // UEX search filters — used in both UEX Routes tab and Create Route dialog
  const defaultSearchParams: UEXRouteSearchParams = {
    minMargin: 5,
    limit: 25,
  };
  const [uexSearchParams, setUexSearchParams] = useState<UEXRouteSearchParams>(defaultSearchParams);
  const [dialogSearchParams, setDialogSearchParams] =
    useState<UEXRouteSearchParams>(defaultSearchParams);

  // React Query hooks for server data
  const {
    data: routesData,
    isLoading: routesLoading,
    error: routesError,
  } = useTradingRoutes(organizationId, undefined, {
    enabled: activeTab === 'routes' && !!organizationId,
  });
  const routes = routesData?.items ?? [];

  const [findParams, setFindParams] = useState({
    startLocation: '',
    minProfit: 15,
  });

  const {
    data: opportunitiesData,
    isLoading: opportunitiesLoading,
    error: opportunitiesError,
  } = useTradingOpportunities(
    { minProfit: findParams.minProfit },
    { enabled: activeTab === 'opportunities' }
  );
  // opportunities response shape varies
  const opportunities = ((opportunitiesData as unknown as Record<string, unknown>)?.opportunities ??
    []) as Array<{
    commodity: string;
    buyLocation: string;
    sellLocation: string;
    buyPrice: number;
    sellPrice: number;
    profit: number;
    profitMargin: number;
    supply: string;
    demand: string;
  }>;

  const loading = (() => {
    if (activeTab === 'routes') return routesLoading;
    if (activeTab === 'opportunities') return opportunitiesLoading;
    return false;
  })();
  const error = (() => {
    if (activeTab === 'routes') return routesError;
    if (activeTab === 'opportunities') return opportunitiesError;
    return null;
  })();

  // UEX suggested routes
  const {
    data: uexData,
    isLoading: uexLoading,
    error: uexError,
  } = useUexRoutes(organizationId, uexSearchParams, {
    enabled: activeTab === 'uex-routes' && !!organizationId,
  });
  const uexRoutes = uexData?.routes ?? [];

  // UEX routes for the create dialog — uses separate search params
  const { data: dialogUexData, isLoading: dialogUexLoading } = useUexRoutes(
    organizationId,
    dialogSearchParams,
    {
      enabled: showCreateDialog && !!organizationId,
    }
  );
  const dialogRoutes = dialogUexData?.routes ?? [];

  // UEX reference data for dropdowns
  const { data: uexTerminals = [] } = useUexTerminals(organizationId);
  const { data: uexCommodities = [] } = useUexCommodities(organizationId);

  // Derive unique star systems from terminals for dropdown
  const starSystems = [...new Set(uexTerminals.map(t => t.starSystem).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );

  const {
    openDialog: openDeleteConfirm,
    closeDialog: closeDeleteConfirm,
    pendingData: pendingDeleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();

  const {
    openDialog: openDeleteAlertConfirm,
    closeDialog: closeDeleteAlertConfirm,
    pendingData: pendingDeleteAlertId,
    dialogProps: deleteAlertDialogProps,
  } = useConfirmDialog<string>();

  // Mutation hooks
  const createRouteMutation = useCreateTradingRoute(organizationId);
  const deleteRouteMutation = useDeleteTradingRoute(organizationId);

  // Price Alerts - React Query hooks
  const { data: alerts = [], isLoading: alertsLoading } = usePriceAlerts();
  const createAlertMutation = useCreatePriceAlert();
  const updateAlertMutation = useUpdatePriceAlert();
  const deleteAlertMutation = useDeletePriceAlert();

  const [showCreateAlertDialog, setShowCreateAlertDialog] = useState(false);
  const [alertForm, setAlertForm] = useState<CreatePriceAlertInput>({
    commodity: '',
    condition: 'above' as PriceAlertCondition,
    threshold: 0,
    location: '',
  });

  const [routeForm, setRouteForm] = useState({
    name: '',
    startLocation: '',
    endLocation: '',
    commodity: '',
    expectedProfit: 0,
  });

  const handleCreateRoute = async () => {
    if (!organizationId) return;
    try {
      await createRouteMutation.mutateAsync({
        name:
          routeForm.name ||
          `${routeForm.commodity}: ${routeForm.startLocation} → ${routeForm.endLocation}`,
        stops: [
          {
            location: routeForm.startLocation,
            order: 1,
            buyGoods: routeForm.commodity ? [routeForm.commodity] : [],
          },
          {
            location: routeForm.endLocation,
            order: 2,
            sellGoods: routeForm.commodity ? [routeForm.commodity] : [],
          },
        ],
        estimatedProfit: routeForm.expectedProfit || undefined,
        tags: routeForm.commodity ? [routeForm.commodity.toLowerCase()] : [],
      });
      setShowCreateDialog(false);
      resetRouteForm();
      setActiveTab('routes');
    } catch {
      // React Query handles error state
    }
  };

  const handleAddUexRoute = async (uexRoute: UEXTradeRoute, closeDialog = false) => {
    if (!organizationId) return;
    try {
      await createRouteMutation.mutateAsync({
        name: `${uexRoute.commodity}: ${uexRoute.buyTerminal} → ${uexRoute.sellTerminal}`,
        description: `Auto-generated from UEX Corp data. Profit margin: ${uexRoute.profitMargin ?? 0}%`,
        stops: [
          {
            location: uexRoute.buyTerminal,
            order: 1,
            buyGoods: [uexRoute.commodity],
          },
          {
            location: uexRoute.sellTerminal,
            order: 2,
            sellGoods: [uexRoute.commodity],
          },
        ],
        estimatedProfit: uexRoute.profitPerScu,
        tags: ['uex', uexRoute.commodityCode.toLowerCase()],
      });
      if (closeDialog) {
        setShowCreateDialog(false);
        resetRouteForm();
      }
      setActiveTab('routes');
    } catch {
      // React Query handles error state
    }
  };

  const handleDeleteRouteClick = (id: string) => {
    openDeleteConfirm(id);
  };

  const handleDeleteRouteConfirm = async () => {
    const id = pendingDeleteId;
    closeDeleteConfirm();
    if (!id) return;
    try {
      await deleteRouteMutation.mutateAsync(id);
    } catch {
      // React Query handles error state
    }
  };

  const resetRouteForm = () => {
    setRouteForm({
      name: '',
      startLocation: '',
      endLocation: '',
      commodity: '',
      expectedProfit: 0,
    });
    setDialogSearchParams(defaultSearchParams);
  };

  const resetAlertForm = () => {
    setAlertForm({
      commodity: '',
      condition: 'above' as PriceAlertCondition,
      threshold: 0,
      location: '',
    });
  };

  const handleCreateAlert = async () => {
    try {
      const input: CreatePriceAlertInput = {
        commodity: alertForm.commodity,
        condition: alertForm.condition,
        threshold: alertForm.threshold,
      };
      if (alertForm.location) {
        input.location = alertForm.location;
      }
      await createAlertMutation.mutateAsync(input);
      setShowCreateAlertDialog(false);
      resetAlertForm();
    } catch (err) {
      logger.error(
        'Failed to create price alert',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleToggleAlert = async (alertId: string, currentEnabled: boolean) => {
    try {
      await updateAlertMutation.mutateAsync({
        id: alertId,
        data: { enabled: !currentEnabled },
      });
    } catch (err) {
      logger.error(
        'Failed to toggle price alert',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleDeleteAlertConfirm = async () => {
    const id = pendingDeleteAlertId;
    closeDeleteAlertConfirm();
    if (!id) return;
    try {
      await deleteAlertMutation.mutateAsync(id);
    } catch (err) {
      logger.error(
        'Failed to delete price alert',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const formatConditionLabel = (condition: PriceAlertCondition): string => {
    switch (condition) {
      case 'above':
        return 'Above';
      case 'below':
        return 'Below';
      case 'change_percent':
        return 'Change %';
      default:
        return condition;
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A';
    return `${price.toLocaleString()} aUEC`;
  };

  const formatProfit = (profit?: number) => {
    if (!profit) return 'N/A';
    return `${profit.toFixed(1)}%`;
  };

  const calculateMargin = (buyPrice?: number, sellPrice?: number) => {
    if (!buyPrice || !sellPrice) return 0;
    return ((sellPrice - buyPrice) / buyPrice) * 100;
  };

  return (
    <FeatureErrorBoundary featureName="Trading Management" showHomeButton={true}>
      <Box width="100%">
        {/* Page Header */}
        <PageHeader
          title="Trading & Routes"
          description="Discover profitable trading opportunities and manage routes"
          helpTooltip="Create and share trade routes between locations. Track commodity prices, calculate profit margins, and coordinate with org members."
          primaryAction={{
            label: 'Create Route',
            icon: Add,
            onPress: () => setShowCreateDialog(true),
          }}
        />

        {/* Error Display */}
        {error && (
          <Box marginTop="size-200">
            <ErrorMessage
              message={error instanceof Error ? error.message : 'Failed to load trading data'}
            />
          </Box>
        )}

        {/* Find Opportunities Section */}
        <Box sx={{ mt: 3 }}>
          <Box
            sx={{ backgroundColor: theme.palette.background.default, borderRadius: '8px', p: 3 }}
          >
            <Typography
              variant="h6"
              sx={{ color: theme.palette.primary.main, fontSize: '1.25rem', mb: 2 }}
            >
              Find Trade Opportunities
            </Typography>
            <Stack direction="row" gap={2} alignItems="flex-end" flexWrap="wrap">
              <TextField
                label="Start Location"
                value={findParams.startLocation}
                onChange={e => setFindParams({ ...findParams, startLocation: e.target.value })}
                placeholder="e.g., Port Olisar"
                sx={{ minWidth: { xs: '100%', sm: 280 } }}
              />
              <FormControl sx={{ width: 180 }}>
                <FormLabel id="min-profit-label">Min Profit %</FormLabel>
                <TextField
                  aria-labelledby="min-profit-label"
                  type="number"
                  value={findParams.minProfit}
                  onChange={e =>
                    setFindParams({ ...findParams, minProfit: Number(e.target.value) })
                  }
                  slotProps={{ htmlInput: { min: 0 } }}
                />
              </FormControl>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setFindParams({ ...findParams })}
                startIcon={<Search />}
              >
                Find Opportunities
              </Button>
              <Button variant="outlined" color="primary" startIcon={<LocationOn />}>
                Optimize Route
              </Button>
            </Stack>
          </Box>
        </Box>

        {/* Tabs Section */}
        <Box sx={{ mt: 3 }}>
          <Tabs value={activeTab} onChange={(_e, newValue) => setActiveTab(newValue)}>
            <Tab label={`Opportunities (${opportunities.length})`} value="opportunities" />
            <Tab label={`My Routes (${routes.length})`} value="routes" />
            <Tab
              label={`UEX Routes (${uexRoutes.length})`}
              value="uex-routes"
              icon={<TrendingUp fontSize="small" />}
              iconPosition="start"
            />
            <Tab
              label={`Price Alerts (${alerts.length})`}
              value="alerts"
              icon={<Notifications fontSize="small" />}
              iconPosition="start"
            />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {/* Opportunities Panel */}
            {activeTab === 'opportunities' && (
              <Box
                sx={{
                  backgroundColor: theme.palette.background.default,
                  borderRadius: '8px',
                  p: 3,
                  mt: 2,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ color: theme.palette.primary.main, fontSize: '1.25rem', mb: 2 }}
                >
                  Profitable Opportunities
                </Typography>

                {loading && <LoadingSpinner />}

                {!loading && opportunities.length === 0 && (
                  <Box sx={{ p: 4 }}>
                    <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
                      No opportunities found. Try adjusting your search parameters.
                    </Typography>
                  </Box>
                )}

                {!loading && opportunities.length > 0 && (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box
                      component="table"
                      sx={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        color: theme.palette.text.primary,
                      }}
                    >
                      <Box component="thead">
                        <Box
                          component="tr"
                          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                        >
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'left',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Commodity
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'left',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Buy From
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'right',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Buy Price
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'left',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Sell To
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'right',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Sell Price
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'right',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Profit
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'center',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Margin
                          </Box>
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {opportunities.map(opp => {
                          const margin = calculateMargin(opp.buyPrice, opp.sellPrice);
                          return (
                            <Box
                              component="tr"
                              key={`${opp.commodity}-${opp.buyLocation}-${opp.sellLocation}`}
                              sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                            >
                              <Box component="td" sx={{ p: '12px', fontWeight: 600 }}>
                                {opp.commodity}
                              </Box>
                              <Box
                                component="td"
                                sx={{ p: '12px', color: theme.palette.text.secondary }}
                              >
                                {opp.buyLocation}
                              </Box>
                              <Box
                                component="td"
                                sx={{
                                  p: '12px',
                                  textAlign: 'right',
                                  color: theme.palette.error.light,
                                  fontWeight: 600,
                                }}
                              >
                                {formatPrice(opp.buyPrice)}
                              </Box>
                              <Box
                                component="td"
                                sx={{ p: '12px', color: theme.palette.text.secondary }}
                              >
                                {opp.sellLocation}
                              </Box>
                              <Box
                                component="td"
                                sx={{
                                  p: '12px',
                                  textAlign: 'right',
                                  color: theme.palette.success.light,
                                  fontWeight: 600,
                                }}
                              >
                                {formatPrice(opp.sellPrice)}
                              </Box>
                              <Box
                                component="td"
                                sx={{
                                  p: '12px',
                                  textAlign: 'right',
                                  color: theme.palette.success.main,
                                  fontWeight: 700,
                                  fontSize: '1rem',
                                }}
                              >
                                {formatProfit(opp.profitMargin)}
                              </Box>
                              <Box component="td" sx={{ p: '12px', textAlign: 'center' }}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: '60px',
                                      height: '8px',
                                      backgroundColor: theme.palette.background.paper,
                                      borderRadius: '4px',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        width: `${Math.min(margin, 100)}%`,
                                        height: '100%',
                                        backgroundColor: theme.palette.success.main,
                                        transition: theme.transitions.create('width', {
                                          duration: 300,
                                        }),
                                      }}
                                    />
                                  </Box>
                                  <Typography
                                    sx={{
                                      color: theme.palette.success.main,
                                      fontSize: '0.875rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {margin.toFixed(0)}%
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* My Routes Panel */}
            {activeTab === 'routes' && (
              <Box
                sx={{
                  backgroundColor: theme.palette.background.default,
                  borderRadius: '8px',
                  p: 3,
                  mt: 2,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ color: theme.palette.primary.main, fontSize: '1.25rem', mb: 2 }}
                >
                  My Trading Routes
                </Typography>

                {loading && <LoadingSpinner />}

                {!loading && routes.length === 0 && (
                  <Box sx={{ p: 4 }}>
                    <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
                      No routes created yet. Create your first trading route to get started.
                    </Typography>
                  </Box>
                )}

                {!loading && routes.length > 0 && (
                  <Stack direction="column" gap="size-200">
                    {routes.map(route => (
                      <Box
                        key={route.id}
                        sx={{
                          borderRadius: 1,
                          p: 2,
                          backgroundColor: theme.palette.background.paper,
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography
                              variant="subtitle1"
                              sx={{ color: theme.palette.text.primary, mb: 1 }}
                            >
                              {route.name}
                            </Typography>
                            <Typography
                              sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}
                            >
                              {route.stops?.map((s: TradeStop) => s.location).join(' → ')}
                            </Typography>
                            {route.estimatedProfit && (
                              <Typography
                                sx={{
                                  color: theme.palette.success.main,
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  mt: 0.5,
                                }}
                              >
                                Est. Profit: {formatPrice(route.estimatedProfit)}
                              </Typography>
                            )}
                          </Box>
                          <Stack gap="size-100">
                            <Tooltip title="Edit route" arrow>
                              <IconButton
                                sx={{ color: theme.palette.primary.main }}
                                aria-label="Edit route"
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete route" arrow>
                              <IconButton
                                onClick={() => handleDeleteRouteClick(route.id)}
                                sx={{ color: theme.palette.error.main }}
                                aria-label="Delete route"
                              >
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            )}

            {/* UEX Routes Panel */}
            {activeTab === 'uex-routes' && (
              <Box
                sx={{
                  backgroundColor: theme.palette.background.default,
                  borderRadius: '8px',
                  p: 3,
                  mt: 2,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Typography
                    variant="h6"
                    sx={{ color: theme.palette.primary.main, fontSize: '1.25rem' }}
                  >
                    UEX Corp Trade Routes
                  </Typography>
                  <Stack direction="row" gap={1} alignItems="center">
                    <FormControl sx={{ width: 140 }}>
                      <TextField
                        label="Min Margin %"
                        type="number"
                        size="small"
                        value={uexSearchParams.minMargin ?? 5}
                        onChange={e =>
                          setUexSearchParams({
                            ...uexSearchParams,
                            minMargin: Number(e.target.value),
                          })
                        }
                        slotProps={{ htmlInput: { min: 0, max: 100 } }}
                      />
                    </FormControl>
                  </Stack>
                </Stack>

                {uexData?.disclaimer && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {uexData.disclaimer}
                  </Alert>
                )}

                {uexError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load UEX routes. Ensure the UEX API key is configured.
                  </Alert>
                )}

                {uexLoading && <LoadingSpinner />}

                {!uexLoading && !uexError && uexRoutes.length === 0 && (
                  <Box sx={{ p: 4 }}>
                    <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
                      No trade routes found. Try lowering the minimum margin.
                    </Typography>
                  </Box>
                )}

                {!uexLoading && uexRoutes.length > 0 && (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box
                      component="table"
                      sx={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        color: theme.palette.text.primary,
                      }}
                    >
                      <Box component="thead">
                        <Box
                          component="tr"
                          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                        >
                          {[
                            'Commodity',
                            'Buy From',
                            'Buy Price',
                            'Sell To',
                            'Sell Price',
                            'Profit/SCU',
                            'Margin',
                            'SCU',
                            'Updated',
                            '',
                          ].map(header => (
                            <Box
                              component="th"
                              key={header}
                              sx={{
                                p: '12px',
                                textAlign:
                                  header === 'Buy Price' ||
                                  header === 'Sell Price' ||
                                  header === 'Profit/SCU' ||
                                  header === 'SCU' ||
                                  header === 'Updated'
                                    ? 'right'
                                    : 'left',
                                color: theme.palette.text.secondary,
                                fontSize: '0.875rem',
                                fontWeight: 600,
                              }}
                            >
                              {header}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {uexRoutes.map(route => (
                          <Box
                            component="tr"
                            key={`${route.commodityCode}-${route.buyTerminal}-${route.sellTerminal}`}
                            sx={{
                              borderBottom: `1px solid ${theme.palette.divider}`,
                              '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                              },
                            }}
                          >
                            <Box component="td" sx={{ p: '12px', fontWeight: 600 }}>
                              {route.commodity}
                              {route.buySystem && (
                                <Chip
                                  label={route.buySystem}
                                  size="small"
                                  sx={{ ml: 1, fontSize: '0.7rem', height: 20 }}
                                />
                              )}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '12px',
                                color: theme.palette.text.secondary,
                                fontSize: '0.875rem',
                              }}
                            >
                              {route.buyTerminal}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '12px',
                                textAlign: 'right',
                                color: theme.palette.error.light,
                                fontWeight: 600,
                              }}
                            >
                              {formatPrice(route.buyPrice)}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '12px',
                                color: theme.palette.text.secondary,
                                fontSize: '0.875rem',
                              }}
                            >
                              {route.sellTerminal}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '12px',
                                textAlign: 'right',
                                color: theme.palette.success.light,
                                fontWeight: 600,
                              }}
                            >
                              {formatPrice(route.sellPrice)}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '12px',
                                textAlign: 'right',
                                color: theme.palette.success.main,
                                fontWeight: 700,
                              }}
                            >
                              {formatPrice(route.profitPerScu)}
                            </Box>
                            <Box component="td" sx={{ p: '12px' }}>
                              <Chip
                                label={`${route.profitMargin ?? 0}%`}
                                size="small"
                                sx={{
                                  backgroundColor: getMarginColor(route.profitMargin ?? 0, theme),
                                  color: theme.palette.common.white,
                                  fontWeight: 600,
                                }}
                              />
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '12px',
                                textAlign: 'right',
                                color: theme.palette.text.secondary,
                              }}
                            >
                              {route.scuAvailable?.toLocaleString() ?? 'N/A'}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '12px',
                                textAlign: 'right',
                                color: theme.palette.text.secondary,
                                fontSize: '0.8rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {route.lastUpdated
                                ? new Date(route.lastUpdated).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'N/A'}
                            </Box>
                            <Box component="td" sx={{ p: '12px', textAlign: 'center' }}>
                              <Tooltip title="Add as org route" arrow>
                                <IconButton
                                  onClick={() => handleAddUexRoute(route)}
                                  sx={{ color: theme.palette.primary.main }}
                                  aria-label="Add as org route"
                                  disabled={createRouteMutation.isPending}
                                  size="small"
                                >
                                  <Add />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* Price Alerts Panel */}
            {activeTab === 'alerts' && (
              <Box
                sx={{
                  backgroundColor: theme.palette.background.default,
                  borderRadius: '8px',
                  p: 3,
                  mt: 2,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Typography
                    variant="h6"
                    sx={{ color: theme.palette.primary.main, fontSize: '1.25rem' }}
                  >
                    Price Alerts
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => setShowCreateAlertDialog(true)}
                  >
                    New Alert
                  </Button>
                </Stack>

                {alertsLoading && <LoadingSpinner />}

                {!alertsLoading && alerts.length === 0 && (
                  <Box sx={{ p: 4 }}>
                    <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
                      No price alerts configured. Create alerts to get notified when commodity
                      prices hit your targets.
                    </Typography>
                  </Box>
                )}

                {!alertsLoading && alerts.length > 0 && (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box
                      component="table"
                      sx={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        color: theme.palette.text.primary,
                      }}
                    >
                      <Box component="thead">
                        <Box
                          component="tr"
                          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                        >
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'left',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Commodity
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'left',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Location
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'left',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Condition
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'right',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Threshold
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'center',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Enabled
                          </Box>
                          <Box
                            component="th"
                            sx={{
                              p: '12px',
                              textAlign: 'center',
                              color: theme.palette.text.secondary,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                            }}
                          >
                            Actions
                          </Box>
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {alerts.map(alert => (
                          <Box
                            component="tr"
                            key={alert.id}
                            sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                          >
                            <Box component="td" sx={{ p: '12px', fontWeight: 600 }}>
                              {alert.commodity}
                            </Box>
                            <Box
                              component="td"
                              sx={{ p: '12px', color: theme.palette.text.secondary }}
                            >
                              {alert.location || 'Any'}
                            </Box>
                            <Box component="td" sx={{ p: '12px' }}>
                              {formatConditionLabel(alert.condition)}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '12px',
                                textAlign: 'right',
                                fontWeight: 600,
                              }}
                            >
                              {alert.condition === 'change_percent'
                                ? `${alert.threshold}%`
                                : formatPrice(alert.threshold)}
                            </Box>
                            <Box component="td" sx={{ p: '12px', textAlign: 'center' }}>
                              <Switch
                                checked={alert.enabled}
                                onChange={() => handleToggleAlert(alert.id, alert.enabled)}
                                size="small"
                                disabled={updateAlertMutation.isPending}
                              />
                            </Box>
                            <Box component="td" sx={{ p: '12px', textAlign: 'center' }}>
                              <Tooltip title="Delete alert" arrow>
                                <IconButton
                                  onClick={() => openDeleteAlertConfirm(alert.id)}
                                  sx={{ color: theme.palette.error.main }}
                                  aria-label="Delete alert"
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* Create Route Dialog — UEX-powered search */}
        <Dialog
          open={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            resetRouteForm();
          }}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Create Trading Route</DialogTitle>
          <Divider />
          <DialogContent>
            <Stack direction="column" spacing={3} sx={{ pt: 2 }}>
              {/* UEX Search Filters */}
              <Alert severity="info" sx={{ mb: 0 }}>
                Search UEX Corp data to find profitable routes, or fill in manually below.
              </Alert>

              <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                UEX Route Finder
              </Typography>

              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Autocomplete
                  options={uexCommodities.map(c => c.name)}
                  value={dialogSearchParams.commodity ?? null}
                  onChange={(_e, val) =>
                    setDialogSearchParams({ ...dialogSearchParams, commodity: val ?? undefined })
                  }
                  renderInput={params => (
                    <TextField {...params} label="Commodity" placeholder="e.g. Laranite" />
                  )}
                  freeSolo
                  sx={{ minWidth: 200, flex: 1 }}
                />
                <TextField
                  label="Investment (UEC)"
                  type="number"
                  value={dialogSearchParams.investment ?? ''}
                  onChange={e =>
                    setDialogSearchParams({
                      ...dialogSearchParams,
                      investment: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="e.g. 20,000"
                  slotProps={{ htmlInput: { min: 0 } }}
                  sx={{ minWidth: 150, flex: 1 }}
                />
                <TextField
                  label="SCU"
                  type="number"
                  value={dialogSearchParams.scu ?? ''}
                  onChange={e =>
                    setDialogSearchParams({
                      ...dialogSearchParams,
                      scu: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="e.g. 64"
                  slotProps={{ htmlInput: { min: 0 } }}
                  sx={{ minWidth: 100, flex: 1 }}
                />
              </Stack>

              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Autocomplete
                  options={starSystems}
                  value={dialogSearchParams.starSystemStart ?? null}
                  onChange={(_e, val) =>
                    setDialogSearchParams({
                      ...dialogSearchParams,
                      starSystemStart: val ?? undefined,
                    })
                  }
                  renderInput={params => (
                    <TextField {...params} label="Star System: Start" placeholder="— All" />
                  )}
                  freeSolo
                  sx={{ minWidth: 180, flex: 1 }}
                />
                <Autocomplete
                  options={starSystems}
                  value={dialogSearchParams.starSystemEnd ?? null}
                  onChange={(_e, val) =>
                    setDialogSearchParams({
                      ...dialogSearchParams,
                      starSystemEnd: val ?? undefined,
                    })
                  }
                  renderInput={params => (
                    <TextField {...params} label="Star System: End" placeholder="— All" />
                  )}
                  freeSolo
                  sx={{ minWidth: 180, flex: 1 }}
                />
              </Stack>

              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Autocomplete
                  options={uexTerminals.map(t => t.name)}
                  value={dialogSearchParams.terminalStart ?? null}
                  onChange={(_e, val) =>
                    setDialogSearchParams({
                      ...dialogSearchParams,
                      terminalStart: val ?? undefined,
                    })
                  }
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="Terminal: Start"
                      placeholder="e.g. Everus Harbor"
                    />
                  )}
                  freeSolo
                  sx={{ minWidth: 200, flex: 1 }}
                />
                <Autocomplete
                  options={uexTerminals.map(t => t.name)}
                  value={dialogSearchParams.terminalEnd ?? null}
                  onChange={(_e, val) =>
                    setDialogSearchParams({ ...dialogSearchParams, terminalEnd: val ?? undefined })
                  }
                  renderInput={params => (
                    <TextField {...params} label="Terminal: End" placeholder="e.g. Port Tressler" />
                  )}
                  freeSolo
                  sx={{ minWidth: 200, flex: 1 }}
                />
                <TextField
                  label="Min Margin %"
                  type="number"
                  value={dialogSearchParams.minMargin ?? 5}
                  onChange={e =>
                    setDialogSearchParams({
                      ...dialogSearchParams,
                      minMargin: Number(e.target.value),
                    })
                  }
                  slotProps={{ htmlInput: { min: 0, max: 100 } }}
                  sx={{ minWidth: 120, flex: 0.5 }}
                />
              </Stack>

              {/* UEX Results */}
              {dialogUexLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              )}

              {!dialogUexLoading && dialogRoutes.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                    UEX Results — click + to add as org route
                  </Typography>
                  <Box sx={{ overflowX: 'auto', maxHeight: 300 }}>
                    <Box
                      component="table"
                      sx={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        color: theme.palette.text.primary,
                        fontSize: '0.8125rem',
                      }}
                    >
                      <Box component="thead">
                        <Box
                          component="tr"
                          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                        >
                          {[
                            'Commodity',
                            'Buy From',
                            'Buy',
                            'Sell To',
                            'Sell',
                            'Profit/SCU',
                            'Margin',
                            '',
                          ].map(h => (
                            <Box
                              component="th"
                              key={h}
                              sx={{
                                p: '8px',
                                textAlign:
                                  h === 'Buy' || h === 'Sell' || h === 'Profit/SCU'
                                    ? 'right'
                                    : 'left',
                                color: theme.palette.text.secondary,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {h}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {dialogRoutes.slice(0, 15).map(route => (
                          <Box
                            component="tr"
                            key={`${route.commodityCode}-${route.buyTerminal}-${route.sellTerminal}`}
                            sx={{
                              borderBottom: `1px solid ${theme.palette.divider}`,
                              '&:hover': { backgroundColor: theme.palette.action.hover },
                            }}
                          >
                            <Box component="td" sx={{ p: '8px', fontWeight: 600 }}>
                              {route.commodity}
                            </Box>
                            <Box
                              component="td"
                              sx={{ p: '8px', color: theme.palette.text.secondary }}
                            >
                              {route.buyTerminal}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '8px',
                                textAlign: 'right',
                                color: theme.palette.error.light,
                                fontWeight: 600,
                              }}
                            >
                              {formatPrice(route.buyPrice)}
                            </Box>
                            <Box
                              component="td"
                              sx={{ p: '8px', color: theme.palette.text.secondary }}
                            >
                              {route.sellTerminal}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '8px',
                                textAlign: 'right',
                                color: theme.palette.success.light,
                                fontWeight: 600,
                              }}
                            >
                              {formatPrice(route.sellPrice)}
                            </Box>
                            <Box
                              component="td"
                              sx={{
                                p: '8px',
                                textAlign: 'right',
                                color: theme.palette.success.main,
                                fontWeight: 700,
                              }}
                            >
                              {formatPrice(route.profitPerScu)}
                            </Box>
                            <Box component="td" sx={{ p: '8px' }}>
                              <Chip
                                label={`${route.profitMargin ?? 0}%`}
                                size="small"
                                sx={{
                                  backgroundColor: getMarginColor(route.profitMargin ?? 0, theme),
                                  color: theme.palette.common.white,
                                  fontWeight: 600,
                                }}
                              />
                            </Box>
                            <Box component="td" sx={{ p: '8px', textAlign: 'center' }}>
                              <Tooltip title="Add as org route" arrow>
                                <IconButton
                                  onClick={() => handleAddUexRoute(route, true)}
                                  size="small"
                                  sx={{ color: theme.palette.primary.main }}
                                  disabled={createRouteMutation.isPending}
                                >
                                  <Add fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </>
              )}

              {!dialogUexLoading && dialogRoutes.length === 0 && (
                <Typography
                  sx={{
                    color: theme.palette.text.secondary,
                    textAlign: 'center',
                    py: 2,
                    fontSize: '0.875rem',
                  }}
                >
                  No UEX routes found for these filters. Adjust your search or create manually
                  below.
                </Typography>
              )}

              {/* Manual Route Entry */}
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                Or create manually
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <TextField
                  label="Route Name"
                  value={routeForm.name}
                  onChange={e => setRouteForm({ ...routeForm, name: e.target.value })}
                  placeholder="e.g., Crusader Medical Run"
                  sx={{ minWidth: 250, flex: 2 }}
                />
                <Autocomplete
                  options={uexCommodities.map(c => c.name)}
                  value={routeForm.commodity || null}
                  onChange={(_e, val) => setRouteForm({ ...routeForm, commodity: val ?? '' })}
                  renderInput={params => (
                    <TextField {...params} label="Commodity" placeholder="e.g. Medical Supplies" />
                  )}
                  freeSolo
                  onInputChange={(_e, val) => setRouteForm({ ...routeForm, commodity: val })}
                  sx={{ minWidth: 200, flex: 1 }}
                />
              </Stack>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Autocomplete
                  options={uexTerminals.map(t => t.name)}
                  value={routeForm.startLocation || null}
                  onChange={(_e, val) => setRouteForm({ ...routeForm, startLocation: val ?? '' })}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="Start Location"
                      placeholder="e.g. Everus Harbor"
                    />
                  )}
                  freeSolo
                  onInputChange={(_e, val) => setRouteForm({ ...routeForm, startLocation: val })}
                  sx={{ minWidth: 200, flex: 1 }}
                />
                <Autocomplete
                  options={uexTerminals.map(t => t.name)}
                  value={routeForm.endLocation || null}
                  onChange={(_e, val) => setRouteForm({ ...routeForm, endLocation: val ?? '' })}
                  renderInput={params => (
                    <TextField {...params} label="End Location" placeholder="e.g. Port Tressler" />
                  )}
                  freeSolo
                  onInputChange={(_e, val) => setRouteForm({ ...routeForm, endLocation: val })}
                  sx={{ minWidth: 200, flex: 1 }}
                />
                <TextField
                  label="Expected Profit (aUEC)"
                  type="number"
                  value={routeForm.expectedProfit || ''}
                  onChange={e =>
                    setRouteForm({ ...routeForm, expectedProfit: Number(e.target.value) })
                  }
                  placeholder="Auto-calculated from UEX"
                  slotProps={{ htmlInput: { min: 0 } }}
                  sx={{ minWidth: 180, flex: 1 }}
                />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              variant="outlined"
              onClick={() => {
                setShowCreateDialog(false);
                resetRouteForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateRoute}
              disabled={
                !routeForm.startLocation || !routeForm.endLocation || createRouteMutation.isPending
              }
            >
              Create Route
            </Button>
          </DialogActions>
        </Dialog>

        <ConfirmDialog
          {...deleteDialogProps}
          title="Delete Route"
          message="Are you sure you want to delete this route?"
          confirmLabel="Delete"
          confirmColor="error"
          onConfirm={handleDeleteRouteConfirm}
        />

        {/* Create Alert Dialog */}
        <Dialog
          open={showCreateAlertDialog}
          onClose={() => {
            setShowCreateAlertDialog(false);
            resetAlertForm();
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create Price Alert</DialogTitle>
          <Divider />
          <DialogContent>
            <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
              <TextField
                label="Commodity"
                value={alertForm.commodity}
                onChange={e => setAlertForm({ ...alertForm, commodity: e.target.value })}
                required
                placeholder="e.g., Medical Supplies"
                fullWidth
              />
              <TextField
                label="Location (optional)"
                value={alertForm.location}
                onChange={e => setAlertForm({ ...alertForm, location: e.target.value })}
                placeholder="e.g., Port Olisar"
                fullWidth
              />
              <TextField
                label="Condition"
                value={alertForm.condition}
                onChange={e =>
                  setAlertForm({
                    ...alertForm,
                    condition: e.target.value as PriceAlertCondition,
                  })
                }
                select
                fullWidth
              >
                <MenuItem value="above">Price Above</MenuItem>
                <MenuItem value="below">Price Below</MenuItem>
                <MenuItem value="change_percent">Price Change %</MenuItem>
              </TextField>
              <TextField
                label={
                  alertForm.condition === 'change_percent' ? 'Threshold (%)' : 'Threshold (aUEC)'
                }
                type="number"
                value={alertForm.threshold}
                onChange={e => setAlertForm({ ...alertForm, threshold: Number(e.target.value) })}
                required
                slotProps={{ htmlInput: { min: 0 } }}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              variant="outlined"
              onClick={() => {
                setShowCreateAlertDialog(false);
                resetAlertForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateAlert}
              disabled={
                !alertForm.commodity || alertForm.threshold <= 0 || createAlertMutation.isPending
              }
            >
              Create Alert
            </Button>
          </DialogActions>
        </Dialog>

        <ConfirmDialog
          {...deleteAlertDialogProps}
          title="Delete Price Alert"
          message="Are you sure you want to delete this price alert?"
          confirmLabel="Delete"
          confirmColor="error"
          onConfirm={handleDeleteAlertConfirm}
        />
      </Box>
    </FeatureErrorBoundary>
  );
};

export const TradingWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Trading">
    <Trading />
  </FeatureErrorBoundary>
);
