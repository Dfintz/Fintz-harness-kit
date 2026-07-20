import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CalculateIcon from '@mui/icons-material/Calculate';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { logger } from '@/utils/logger';

import { findOptimalInterdiction, type InterdictionResult, type Point2D } from './interdictionMath';
import { STAR_SYSTEMS, type StarSystem, type StarSystemLocation } from './locationData';
import { SystemMap } from './SystemMap';

// ============================================================================
// Types
// ============================================================================

type SelectionMode = 'origin' | 'destination';

export interface InterdictionCalculatorProps {
  /** Height of the map area. */
  readonly mapHeight?: number | string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDistance(d: number): string {
  return d.toFixed(1);
}

function formatAngle(radians: number): string {
  return `${((radians * 180) / Math.PI).toFixed(1)}\u00B0`;
}

// ============================================================================
// InterdictionCalculator
// ============================================================================

export const InterdictionCalculator: React.FC<InterdictionCalculatorProps> = ({
  mapHeight = 480,
}) => {
  const theme = useTheme();

  // --- Refs -----------------------------------------------------------------
  const mapSvgRef = useRef<SVGSVGElement>(null);

  // --- State ----------------------------------------------------------------
  const [selectedSystem, setSelectedSystem] = useState<StarSystem>(STAR_SYSTEMS[0]);
  const [originCodes, setOriginCodes] = useState<Set<string>>(new Set());
  const [destinationCode, setDestinationCode] = useState<string | null>(null);
  const [qedRange, setQedRange] = useState<number>(25);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('origin');
  const [result, setResult] = useState<InterdictionResult | null>(null);

  const systemLocations = selectedSystem.locations;

  // --- Derived data ---------------------------------------------------------
  const originLocations = useMemo(
    () => systemLocations.filter(l => originCodes.has(l.code)),
    [systemLocations, originCodes]
  );

  const destinationLocation = useMemo(
    () => systemLocations.find(l => l.code === destinationCode) ?? null,
    [systemLocations, destinationCode]
  );

  const routes = useMemo(() => {
    if (!destinationLocation || originLocations.length === 0) return [];
    const dest: Point2D = { x: destinationLocation.mapX, y: destinationLocation.mapY };
    return originLocations.map(o => ({
      origin: { x: o.mapX, y: o.mapY } as Point2D,
      destination: dest,
    }));
  }, [originLocations, destinationLocation]);

  // --- Handlers -------------------------------------------------------------
  const handleLocationClick = useCallback(
    (loc: StarSystemLocation) => {
      if (loc.type === 'star') return; // Don't allow selecting the star

      if (selectionMode === 'origin') {
        setOriginCodes(prev => {
          const next = new Set(prev);
          if (next.has(loc.code)) {
            next.delete(loc.code);
          } else {
            // Don't allow same location as origin and destination
            if (loc.code === destinationCode) return prev;
            next.add(loc.code);
          }
          return next;
        });
        setResult(null);
      } else {
        // Don't allow same location as origin and destination
        if (originCodes.has(loc.code)) return;
        setDestinationCode(prev => (prev === loc.code ? null : loc.code));
        setResult(null);
      }
    },
    [selectionMode, destinationCode, originCodes]
  );

  const handleSwapSides = useCallback(() => {
    const oldOrigins = originCodes;
    const oldDest = destinationCode;

    setOriginCodes(oldDest ? new Set([oldDest]) : new Set());
    setDestinationCode(oldOrigins.size === 1 ? [...oldOrigins][0] : null);
    setResult(null);
  }, [originCodes, destinationCode]);

  const handleClearAll = useCallback(() => {
    setOriginCodes(new Set());
    setDestinationCode(null);
    setResult(null);
  }, []);

  const handleSystemChange = useCallback((_e: React.MouseEvent, sysId: string | null) => {
    if (!sysId) return;
    const sys = STAR_SYSTEMS.find(s => s.id === sysId);
    if (!sys) return;
    setSelectedSystem(sys);
    setOriginCodes(new Set());
    setDestinationCode(null);
    setResult(null);
  }, []);

  const handleCalculate = useCallback(() => {
    if (originLocations.length === 0 || !destinationLocation) return;

    try {
      const origins: Point2D[] = originLocations.map(o => ({ x: o.mapX, y: o.mapY }));
      const dest: Point2D = { x: destinationLocation.mapX, y: destinationLocation.mapY };
      const res = findOptimalInterdiction(origins, dest, qedRange);
      setResult(res);
    } catch (err) {
      logger.error(
        'Interdiction calculation failed',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [originLocations, destinationLocation, qedRange]);

  const handleRemoveOrigin = useCallback((code: string) => {
    setOriginCodes(prev => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
    setResult(null);
  }, []);

  /** Export the current map view as a PNG image. */
  const handleExportMap = useCallback(() => {
    const svg = mapSvgRef.current;
    if (!svg) return;

    try {
      const serializer = new XMLSerializer();
      // Clone SVG and set explicit dimensions so the Image has intrinsic size
      const svgClone = svg.cloneNode(true) as SVGSVGElement;
      const rect = svg.getBoundingClientRect();
      svgClone.setAttribute('width', String(rect.width));
      svgClone.setAttribute('height', String(rect.height));

      const svgStr = serializer.serializeToString(svgClone);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onerror = () => {
        URL.revokeObjectURL(url);
        logger.error('Map export failed: image load error', new Error('SVG image load failed'));
      };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2; // retina-quality export
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          return;
        }
        ctx.scale(scale, scale);
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob) return;
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replaceAll('T', '-')
            .replaceAll(':', '-');
          a.download = `interdiction-${selectedSystem.id.toLowerCase()}-${timestamp}.png`;
          a.click();
          URL.revokeObjectURL(blobUrl);
        }, 'image/png');
      };
      img.src = url;
    } catch (err) {
      logger.error('Map export failed', err instanceof Error ? err : new Error(String(err)));
    }
  }, [selectedSystem.id]);

  const canCalculate = originLocations.length > 0 && destinationLocation !== null;

  // --- Render ---------------------------------------------------------------
  const systemTabSx = (sysId: string, t: Theme) => ({
    fontWeight: 700,
    fontSize: '0.8rem',
    letterSpacing: '0.05em',
    px: 2,
    py: 0.75,
    ...(selectedSystem.id === sysId && {
      bgcolor: alpha(t.palette.warning.main, 0.12),
      color: t.palette.warning.main,
      borderColor: alpha(t.palette.warning.main, 0.4),
    }),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* System tabs — prominent top selector */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          py: 1,
          bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
          borderRadius: '8px 8px 0 0',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <GpsFixedIcon color="warning" fontSize="small" />
        <Typography variant="subtitle2" fontWeight={600}>
          Interdiction Planner
        </Typography>

        <ToggleButtonGroup
          value={selectedSystem.id}
          exclusive
          onChange={handleSystemChange}
          size="small"
          sx={{ ml: 1 }}
        >
          {STAR_SYSTEMS.map(sys => (
            <ToggleButton key={sys.id} value={sys.id} sx={systemTabSx(sys.id, theme)}>
              {sys.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Swap origins ↔ destination">
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SwapHorizIcon />}
              onClick={handleSwapSides}
              disabled={originCodes.size === 0 && !destinationCode}
            >
              Swap
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Clear all selections">
          <span>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<ClearIcon />}
              onClick={handleClearAll}
              disabled={originCodes.size === 0 && !destinationCode}
            >
              Clear
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Export map as PNG">
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportMap}
            >
              Export
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Controls row */}
      <Paper
        elevation={0}
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.grey[900], 0.6) : 'grey.50',
          borderBottom: `1px solid ${theme.palette.divider}`,
          borderRadius: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { md: 'center' },
          }}
        >
          {/* Selection mode toggle */}
          <ToggleButtonGroup
            value={selectionMode}
            exclusive
            onChange={(_e, v) => v && setSelectionMode(v as SelectionMode)}
            size="small"
          >
            <ToggleButton value="origin" color="success">
              <AddCircleOutlineIcon sx={{ mr: 0.5, fontSize: 16 }} />
              Origin
            </ToggleButton>
            <ToggleButton value="destination" color="error">
              <MyLocationIcon sx={{ mr: 0.5, fontSize: 16 }} />
              Dest
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

          {/* Origin chips */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, minHeight: 28 }}>
              {originLocations.length === 0 ? (
                <Typography variant="caption" color="text.disabled">
                  Click map to add origins
                </Typography>
              ) : (
                originLocations.map(ol => (
                  <Chip
                    key={ol.code}
                    label={ol.name}
                    size="small"
                    color="success"
                    variant="outlined"
                    onDelete={() => handleRemoveOrigin(ol.code)}
                  />
                ))
              )}
            </Box>
          </Box>

          {/* Destination chip / indicator */}
          <Box sx={{ minWidth: 0 }}>
            {destinationLocation ? (
              <Chip
                label={`→ ${destinationLocation.name}`}
                size="small"
                color="error"
                variant="outlined"
                onDelete={() => {
                  setDestinationCode(null);
                  setResult(null);
                }}
              />
            ) : (
              <Typography variant="caption" color="text.disabled">
                No destination
              </Typography>
            )}
          </Box>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

          {/* QED Range */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 140 }}>
            <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
              QED: {qedRange}
            </Typography>
            <Slider
              value={qedRange}
              onChange={(_e, v) => {
                setQedRange(Array.isArray(v) ? v[0] : v);
                setResult(null);
              }}
              min={5}
              max={60}
              step={1}
              size="small"
              sx={{ minWidth: 80 }}
            />
          </Stack>

          {/* Calculate button */}
          <Button
            variant="contained"
            color="warning"
            startIcon={<CalculateIcon />}
            onClick={handleCalculate}
            disabled={!canCalculate}
            size="small"
          >
            Calculate
          </Button>
        </Box>
      </Paper>

      {/* Map */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SystemMap
          systemId={selectedSystem.id}
          systemName={selectedSystem.name}
          locations={systemLocations}
          areas={selectedSystem.areas}
          originCodes={originCodes}
          destinationCode={destinationCode}
          interdictionPoint={result?.position}
          qedRange={qedRange}
          routes={routes}
          viable={result?.viable}
          onLocationClick={handleLocationClick}
          height={mapHeight}
          svgRef={mapSvgRef}
        />
      </Box>

      {/* Results panel */}
      {result && (
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
            borderRadius: '0 0 8px 8px',
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Chip
              label={result.viable ? 'VIABLE' : 'NOT VIABLE'}
              color={result.viable ? 'success' : 'error'}
              size="small"
              sx={{ fontWeight: 700 }}
            />

            <Divider orientation="vertical" flexItem />

            <Box>
              <Typography variant="caption" color="text.secondary">
                Interdiction Point
              </Typography>
              <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                ({result.position.x.toFixed(0)}, {result.position.y.toFixed(0)})
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Distance to Dest.
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {formatDistance(result.distanceToDestination)}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Max Route Distance
              </Typography>
              <Typography
                variant="body2"
                fontFamily="monospace"
                color={result.viable ? 'success.main' : 'error.main'}
              >
                {formatDistance(result.maxRouteDistance)} / {qedRange}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Fan Angle
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {formatAngle(result.fanAngle)}
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Per-route distances */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.25, display: 'block' }}
              >
                Per-Route Distances
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {result.routeDistances.map((d, i) => {
                  const routeName = originLocations[i]?.name ?? `Route ${String(i + 1)}`;
                  return (
                    <Chip
                      key={originLocations[i]?.code ?? i}
                      label={`${routeName}: ${formatDistance(d)}`}
                      size="small"
                      color={d <= qedRange ? 'success' : 'error'}
                      variant="outlined"
                      sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                    />
                  );
                })}
              </Box>
            </Box>
          </Stack>

          {!result.viable && (
            <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
              The angular spread of the selected origins is too wide for the current QED range. Try
              increasing the range, reducing the number of origins, or selecting origins that are
              closer together.
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
};
