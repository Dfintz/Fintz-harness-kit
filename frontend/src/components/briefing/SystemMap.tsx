import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { Box, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Point2D } from './interdictionMath';
import { closestPointOnSegment, dist } from './interdictionMath';
import {
  MAP_CENTER,
  MAP_SIZE,
  SYSTEM_ORBIT_RADII,
  type StarSystemLocation,
  type SystemArea,
} from './locationData';

// ============================================================================
// Types
// ============================================================================

export interface SystemMapProps {
  /** System identifier (STANTON, PYRO, NYX) for orbit rings and label. */
  readonly systemId: string;
  /** System display name. */
  readonly systemName: string;
  /** All locations to render. */
  readonly locations: readonly StarSystemLocation[];
  /** System areas (e.g. Aaron Halo asteroid belt). */
  readonly areas?: readonly SystemArea[];
  /** Locations selected as origins (green). */
  readonly originCodes?: ReadonlySet<string>;
  /** Location code selected as destination (red). */
  readonly destinationCode?: string | null;
  /** Computed interdiction point to display. */
  readonly interdictionPoint?: Point2D | null;
  /** QED range radius (map-px) to draw around the interdiction point. */
  readonly qedRange?: number;
  /** Route lines to draw (origin→destination). */
  readonly routes?: readonly { origin: Point2D; destination: Point2D }[];
  /** Whether the interdiction result is viable. */
  readonly viable?: boolean;
  /** Called when a location is clicked. */
  readonly onLocationClick?: (location: StarSystemLocation) => void;
  /** SVG height (width fills container). */
  readonly height?: number | string;
  /** Ref forwarded to the SVG element for export. */
  readonly svgRef?: React.RefObject<SVGSVGElement | null>;
}

// ============================================================================
// Visual constants
// ============================================================================

const LOC_SIZE: Record<StarSystemLocation['type'], number> = {
  star: 10,
  planet: 7,
  moon: 3.5,
  station: 3,
  lagrange: 3,
  city: 2.5,
  jump_point: 5,
};

const LOC_FILL: Record<StarSystemLocation['type'], string> = {
  star: '#fbbf24',
  planet: '#60a5fa',
  moon: '#94a3b8',
  station: '#34d399',
  lagrange: '#a78bfa',
  city: '#f472b6',
  jump_point: '#38bdf8',
};

const LABEL_OFFSET_Y: Record<StarSystemLocation['type'], number> = {
  star: 18,
  planet: 14,
  moon: 10,
  station: 10,
  lagrange: 10,
  city: 9,
  jump_point: 13,
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

/** Selection-state colors for interactive map elements (SVG canvas). */
const SELECTION_COLORS = {
  /** Destination (red) fill */
  destinationFill: '#ef4444',
  /** Origin (green) fill */
  originFill: '#22c55e',
  /** Destination stroke (light red) */
  destinationStroke: '#fca5a5',
  /** Origin stroke (light green) */
  originStroke: '#86efac',
  /** Hover stroke (slate) */
  hoverStroke: '#e2e8f0',
  /** Map canvas background */
  canvasBg: '#0a0e17',
  /** Control icon color (muted slate) */
  controlIcon: '#94a3b8',
} as const;

// ============================================================================
// Sub-components
// ============================================================================

const AreaRings: React.FC<{ areas: readonly SystemArea[] }> = React.memo(({ areas }) => (
  <g>
    {areas.map(a => (
      <circle
        key={a.name}
        cx={a.centerX}
        cy={a.centerY}
        r={a.radius}
        fill="rgba(251,191,36,0.04)"
        stroke="rgba(251,191,36,0.18)"
        strokeWidth={1.2}
        strokeDasharray="6 4"
      />
    ))}
  </g>
));
AreaRings.displayName = 'AreaRings';

/** Renders the correct SVG shape for a location type. */
const LocationShape: React.FC<{
  loc: StarSystemLocation;
  r: number;
  fill: string;
  stroke: string | undefined;
}> = React.memo(({ loc, r, fill, stroke }) => {
  if (loc.type === 'jump_point') {
    return (
      <g>
        <circle
          cx={loc.mapX}
          cy={loc.mapY}
          r={r + 4}
          fill="none"
          stroke="rgba(56,189,248,0.25)"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
        <rect
          x={loc.mapX - r}
          y={loc.mapY - r}
          width={r * 2}
          height={r * 2}
          fill={fill}
          stroke={stroke ?? 'rgba(56,189,248,0.6)'}
          strokeWidth={stroke ? 1.5 : 1}
          transform={`rotate(45 ${loc.mapX} ${loc.mapY})`}
          opacity={0.95}
        />
      </g>
    );
  }

  if (loc.type === 'lagrange') {
    return (
      <rect
        x={loc.mapX - r}
        y={loc.mapY - r}
        width={r * 2}
        height={r * 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? 1.5 : 0}
        transform={`rotate(45 ${loc.mapX} ${loc.mapY})`}
        opacity={0.85}
      />
    );
  }

  return (
    <circle
      cx={loc.mapX}
      cy={loc.mapY}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? 1.5 : 0}
      opacity={loc.type === 'star' ? 1 : 0.9}
    />
  );
});
LocationShape.displayName = 'LocationShape';

// ============================================================================
// SystemMap
// ============================================================================

export const SystemMap: React.FC<SystemMapProps> = ({
  systemId,
  systemName,
  locations,
  areas = [],
  originCodes,
  destinationCode,
  interdictionPoint,
  qedRange = 20,
  routes = [],
  viable,
  onLocationClick,
  height = 500,
  svgRef: externalSvgRef,
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const internalSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = externalSvgRef ?? internalSvgRef;
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  // Track whether the mouse moved during a press (to distinguish click vs drag)
  const dragMoved = useRef(false);

  const orbitRadii = useMemo(() => SYSTEM_ORBIT_RADII[systemId] ?? [], [systemId]);

  // Reset zoom/pan when the system changes so the user doesn't see empty space
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [systemId]);

  const importantTypes = useMemo<Set<string>>(() => new Set(['star', 'planet', 'jump_point']), []);

  const isOrigin = useCallback((code: string) => originCodes?.has(code) ?? false, [originCodes]);
  const isDestination = useCallback((code: string) => code === destinationCode, [destinationCode]);

  const getFill = useCallback(
    (loc: StarSystemLocation): string => {
      if (isDestination(loc.code)) return SELECTION_COLORS.destinationFill;
      if (isOrigin(loc.code)) return SELECTION_COLORS.originFill;
      return LOC_FILL[loc.type];
    },
    [isOrigin, isDestination]
  );

  const getStroke = useCallback(
    (loc: StarSystemLocation): string | undefined => {
      if (isDestination(loc.code)) return SELECTION_COLORS.destinationStroke;
      if (isOrigin(loc.code)) return SELECTION_COLORS.originStroke;
      if (hoveredCode === loc.code) return SELECTION_COLORS.hoverStroke;
      return undefined;
    },
    [isOrigin, isDestination, hoveredCode]
  );

  // --- Zoom helpers ---------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleFitContent = useCallback(() => {
    if (locations.length === 0) {
      handleResetView();
      return;
    }
    // Compute bounding box of all locations
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const loc of locations) {
      minX = Math.min(minX, loc.mapX);
      minY = Math.min(minY, loc.mapY);
      maxX = Math.max(maxX, loc.mapX);
      maxY = Math.max(maxY, loc.mapY);
    }
    const padding = 40;
    const bboxW = maxX - minX + padding * 2;
    const bboxH = maxY - minY + padding * 2;
    const fitZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, MAP_SIZE / Math.max(bboxW, bboxH)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoom(fitZoom);
    setPan({ x: MAP_CENTER - cx, y: MAP_CENTER - cy });
  }, [locations, handleResetView]);

  // Compute focal-point pan adjustment for a zoom change
  const computeFocalPan = useCallback(
    (prevZoom: number, newZoom: number, fracX: number, fracY: number) => {
      const dSize = MAP_SIZE / prevZoom - MAP_SIZE / newZoom;
      return { dx: dSize * (fracX - 0.5), dy: dSize * (fracY - 0.5) };
    },
    []
  );

  // Mutable refs for zoom/pan so the wheel handler can read current values
  // without re-registering the listener (avoids stale closures).
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Attach wheel listener imperatively with { passive: false } so preventDefault works.
  // Focal-point zoom: zoom towards cursor position.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorFracX = (e.clientX - rect.left) / rect.width;
      const cursorFracY = (e.clientY - rect.top) / rect.height;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;

      const prevZoom = zoomRef.current;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom + delta));
      if (newZoom === prevZoom) return;

      const adj = computeFocalPan(prevZoom, newZoom, cursorFracX, cursorFracY);
      const prevPan = panRef.current;
      setZoom(newZoom);
      setPan({ x: prevPan.x + adj.dx, y: prevPan.y + adj.dy });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [computeFocalPan]);

  // --- Pan handlers (left-click, middle-click, or shift+click) ----------------
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Allow left-click (0), middle-click (1), or shift+click for panning
      if (e.button !== 0 && e.button !== 1 && !e.shiftKey) return;
      e.preventDefault();
      setIsPanning(true);
      dragMoved.current = false;
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !panStart.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMoved.current = true;
      }
      setPan({ x: panStart.current.panX + dx / zoom, y: panStart.current.panY + dy / zoom });
    },
    [isPanning, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  // Viewbox computation for zoom + pan
  const viewBox = useMemo(() => {
    const size = MAP_SIZE / zoom;
    const cx = MAP_CENTER - size / 2 - pan.x;
    const cy = MAP_CENTER - size / 2 - pan.y;
    return `${cx} ${cy} ${size} ${size}`;
  }, [zoom, pan]);

  // Show more labels when zoomed in
  const showAllLabels = zoom >= 1.5;

  return (
    <Box
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      sx={{
        width: '100%',
        height,
        bgcolor: SELECTION_COLORS.canvasBg,
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative',
        cursor: isPanning ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      {/* Zoom controls */}
      <Stack
        direction="column"
        spacing={0.25}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          bgcolor: 'rgba(10,14,23,0.85)',
          borderRadius: 1,
          p: 0.25,
        }}
      >
        <Tooltip title="Zoom in" placement="left">
          <IconButton size="small" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM}>
            <AddIcon sx={{ fontSize: 16, color: SELECTION_COLORS.controlIcon }} />
          </IconButton>
        </Tooltip>
        <Typography
          variant="caption"
          sx={{
            textAlign: 'center',
            color: SELECTION_COLORS.controlIcon,
            fontSize: '0.65rem',
            lineHeight: 1,
          }}
        >
          {Math.round(zoom * 100)}%
        </Typography>
        <Tooltip title="Zoom out" placement="left">
          <IconButton size="small" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM}>
            <RemoveIcon sx={{ fontSize: 16, color: SELECTION_COLORS.controlIcon }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset view" placement="left">
          <IconButton size="small" onClick={handleResetView}>
            <RestartAltIcon sx={{ fontSize: 16, color: SELECTION_COLORS.controlIcon }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fit all locations" placement="left">
          <IconButton size="small" onClick={handleFitContent}>
            <ZoomOutMapIcon sx={{ fontSize: 16, color: SELECTION_COLORS.controlIcon }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <svg
        ref={svgRef as React.LegacyRef<SVGSVGElement>}
        viewBox={viewBox}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id={`starGlow-${systemId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={LOC_FILL.star} stopOpacity={0.25} />
            <stop offset="100%" stopColor={LOC_FILL.star} stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Star glow */}
        <circle cx={MAP_CENTER} cy={MAP_CENTER} r={45} fill={`url(#starGlow-${systemId})`} />

        {/* Orbit rings */}
        <g>
          {orbitRadii.map(o => (
            <circle
              key={o.name}
              cx={MAP_CENTER}
              cy={MAP_CENTER}
              r={o.radius}
              fill="none"
              stroke="rgba(148,163,184,0.10)"
              strokeWidth={0.8}
              strokeDasharray="4 6"
            />
          ))}
        </g>

        {/* System areas */}
        {areas.length > 0 && <AreaRings areas={areas} />}

        {/* Route lines */}
        {routes.map(r => {
          const routeKey = `${String(r.origin.x)}-${String(r.origin.y)}-${String(r.destination.x)}`;
          return (
            <line
              key={routeKey}
              x1={r.origin.x}
              y1={r.origin.y}
              x2={r.destination.x}
              y2={r.destination.y}
              stroke="rgba(251,191,36,0.35)"
              strokeWidth={1.2}
              strokeDasharray="6 3"
            />
          );
        })}

        {/* Interdiction point */}
        {interdictionPoint && (
          <g>
            {/* Inner range rings at 25%, 50%, 75% of QED range for distance reference */}
            {[0.25, 0.5, 0.75].map(frac => (
              <circle
                key={`range-ring-${String(frac)}`}
                cx={interdictionPoint.x}
                cy={interdictionPoint.y}
                r={qedRange * frac}
                fill="none"
                stroke={viable ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}
                strokeWidth={0.6}
                strokeDasharray="2 3"
              />
            ))}

            {/* QED range circle (outer boundary) */}
            <circle
              cx={interdictionPoint.x}
              cy={interdictionPoint.y}
              r={qedRange}
              fill={viable ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)'}
              stroke={viable ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />

            {/* Range label at top of outer circle */}
            <text
              x={interdictionPoint.x}
              y={interdictionPoint.y - qedRange - 3}
              textAnchor="middle"
              fill={viable ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)'}
              fontSize={7}
              fontFamily="monospace"
              pointerEvents="none"
            >
              QED {qedRange}
            </text>

            {/* Perpendicular distance lines from interdiction point to each route */}
            {routes.map((r, _i) => {
              const foot = closestPointOnSegment(interdictionPoint, r.origin, r.destination);
              const d = dist(interdictionPoint, foot);
              if (d < 0.5) return null; // Skip near-zero distances

              const withinRange = d <= qedRange;
              const lineColor = withinRange ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)';
              const labelColor = withinRange ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)';

              // Place label at midpoint of perpendicular line
              const midX = (interdictionPoint.x + foot.x) / 2;
              const midY = (interdictionPoint.y + foot.y) / 2;

              // Compute label offset perpendicular to the line
              const perpDx = foot.x - interdictionPoint.x;
              const perpDy = foot.y - interdictionPoint.y;
              const perpLen = Math.hypot(perpDx, perpDy);
              const offsetX = perpLen > 0 ? (-perpDy / perpLen) * 5 : 5;
              const offsetY = perpLen > 0 ? (perpDx / perpLen) * 5 : 0;

              const routeKey = `perp-${String(r.origin.x)}-${String(r.origin.y)}`;
              return (
                <g key={routeKey}>
                  {/* Perpendicular dashed line */}
                  <line
                    x1={interdictionPoint.x}
                    y1={interdictionPoint.y}
                    x2={foot.x}
                    y2={foot.y}
                    stroke={lineColor}
                    strokeWidth={1}
                    strokeDasharray="3 2"
                  />
                  {/* Small dot at the foot point */}
                  <circle cx={foot.x} cy={foot.y} r={2} fill={lineColor} />
                  {/* Distance label */}
                  <text
                    x={midX + offsetX}
                    y={midY + offsetY}
                    textAnchor="middle"
                    fill={labelColor}
                    fontSize={7}
                    fontFamily="monospace"
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    {d.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Crosshair */}
            <line
              x1={interdictionPoint.x - 8}
              y1={interdictionPoint.y}
              x2={interdictionPoint.x + 8}
              y2={interdictionPoint.y}
              stroke={viable ? SELECTION_COLORS.originFill : SELECTION_COLORS.destinationFill}
              strokeWidth={1.5}
            />
            <line
              x1={interdictionPoint.x}
              y1={interdictionPoint.y - 8}
              x2={interdictionPoint.x}
              y2={interdictionPoint.y + 8}
              stroke={viable ? SELECTION_COLORS.originFill : SELECTION_COLORS.destinationFill}
              strokeWidth={1.5}
            />
            <circle
              cx={interdictionPoint.x}
              cy={interdictionPoint.y}
              r={4}
              fill="none"
              stroke={viable ? SELECTION_COLORS.originFill : SELECTION_COLORS.destinationFill}
              strokeWidth={1.5}
            />
          </g>
        )}

        {/* Location markers */}
        {locations.map(loc => {
          const r = LOC_SIZE[loc.type];
          const fill = getFill(loc);
          const stroke = getStroke(loc);
          const showLabel =
            showAllLabels ||
            importantTypes.has(loc.type) ||
            hoveredCode === loc.code ||
            isOrigin(loc.code) ||
            isDestination(loc.code);

          const tooltipTitle = loc.parent ? `${loc.name} (${loc.parent})` : loc.name;

          return (
            <Tooltip key={loc.code} title={tooltipTitle}>
              <g
                cursor={onLocationClick ? 'pointer' : 'grab'}
                onClick={() => {
                  if (!dragMoved.current) onLocationClick?.(loc);
                }}
                onMouseEnter={() => setHoveredCode(loc.code)}
                onMouseLeave={() => setHoveredCode(null)}
              >
                <circle cx={loc.mapX} cy={loc.mapY} r={Math.max(r + 4, 8)} fill="transparent" />

                <LocationShape loc={loc} r={r} fill={fill} stroke={stroke} />

                {showLabel && (
                  <text
                    x={loc.mapX}
                    y={loc.mapY + LABEL_OFFSET_Y[loc.type]}
                    textAnchor="middle"
                    fill={theme.palette.text.secondary}
                    fontSize={loc.type === 'star' || loc.type === 'planet' ? 10 : 8}
                    fontFamily="sans-serif"
                    fontWeight={loc.type === 'planet' ? 600 : 400}
                    pointerEvents="none"
                  >
                    {loc.name}
                  </text>
                )}
              </g>
            </Tooltip>
          );
        })}

        {/* System label */}
        <text
          x={16}
          y={24}
          fill="rgba(148,163,184,0.5)"
          fontSize={12}
          fontFamily="monospace"
          pointerEvents="none"
        >
          {systemName.toUpperCase()} SYSTEM
        </text>
      </svg>
    </Box>
  );
};
