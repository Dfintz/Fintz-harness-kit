import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import NearMeIcon from '@mui/icons-material/NearMe';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TimelineIcon from '@mui/icons-material/Timeline';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { type Briefing, type BriefingElement } from '@/services/briefingService';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';

import { TacticalIconPalette, type FormationSize, type TacticalUnitType } from './TacticalIcons';

// ============================================================================
// Types
// ============================================================================

type DrawingTool = 'select' | 'marker' | 'text' | 'line' | 'arrow' | 'tactical-unit';

interface TacticalPlacement {
  unitType: TacticalUnitType;
  size: FormationSize;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const GRID_SIZE = 50;

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  draft: 'default',
  active: 'primary',
  completed: 'success',
  archived: 'warning',
};

const CANVAS_STYLE_SELECT: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  cursor: 'default',
  display: 'block',
};

const CANVAS_STYLE_DRAW: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  cursor: 'crosshair',
  display: 'block',
};

export interface TacticalCanvasProps {
  readonly briefing: Briefing;
  readonly onAddElement: (element: BriefingElement) => Promise<void>;
  readonly onStatusChange: (status: string) => void;
  readonly onCreateVersion: () => void;
  readonly onClearCanvas: () => void;
  /** Optional background image URL or data-URL to render behind drawn elements. */
  readonly backgroundImageUrl?: string | null;
  /** Called when the user uploads or removes a background image. */
  readonly onBackgroundImageChange?: (dataUrl: string | null) => void;
  /** Current page index (0-based). */
  readonly currentPageIndex: number;
  /** Total number of pages. */
  readonly pageCount: number;
  /** Called when the user navigates to a different page. */
  readonly onPageChange: (pageIndex: number) => void;
  /** Called when the user adds a new page. */
  readonly onAddPage: () => void;
  /** Called when the user deletes the current page. */
  readonly onDeletePage: () => void;
}

// ============================================================================
// Canvas Drawing Helpers
// ============================================================================

const TACTICAL_UNIT_SYMBOL: Record<TacticalUnitType, string> = {
  fighter: 'FTR',
  bomber: 'BMR',
  scout: 'SCT',
  transport: 'TPT',
  capital: 'CAP',
  support: 'SUP',
  mining: 'MIN',
  salvage: 'SAL',
};

const SIZE_MARKS: Record<FormationSize, string> = {
  element: '.',
  flight: '..',
  platoon: '...',
  squadron: 'II',
  fleet: 'III',
};

const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, color: string) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  for (let x = 0; x < width; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

const drawTacticalUnit = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unitType: TacticalUnitType,
  size: FormationSize,
  color: string
) => {
  const r = 28; // hex "radius"
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;

  // Draw hexagonal frame
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.1;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();

  // Corner accent lines
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  const topAngle = -Math.PI / 2;
  const ax = x + r * Math.cos(topAngle);
  const ay = y + r * Math.sin(topAngle);
  ctx.beginPath();
  ctx.moveTo(ax - 4, ay + 2);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + 4, ay + 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Size mark above hex
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(SIZE_MARKS[size] ?? '', x, y - r - 4);

  // Unit abbreviation inside hex
  ctx.font = 'bold 12px monospace';
  ctx.fillText(TACTICAL_UNIT_SYMBOL[unitType] ?? '?', x, y + 4);

  // Small role label below hex
  ctx.font = '9px sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText(unitType.toUpperCase(), x, y + r + 12);
  ctx.globalAlpha = 1;
};

const drawElement = (
  ctx: CanvasRenderingContext2D,
  element: BriefingElement,
  primaryColor: string,
  accentColor: string
) => {
  const { position } = element;
  if (!position) return;
  const { x, y } = position;
  const data = element.data ?? {};

  ctx.strokeStyle = primaryColor;
  ctx.fillStyle = primaryColor;
  ctx.lineWidth = 2;

  switch (element.type) {
    case 'text':
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(data.text ?? ''), x, y);
      break;
    case 'marker':
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();
      break;
    case 'line':
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(Number(data.endX ?? x + 80), Number(data.endY ?? y + 80));
      ctx.stroke();
      break;
    case 'arrow': {
      const endX = Number(data.endX ?? x + 80);
      const endY = Number(data.endY ?? y + 80);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      const angle = Math.atan2(endY - y, endX - x);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - 12 * Math.cos(angle - Math.PI / 6),
        endY - 12 * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - 12 * Math.cos(angle + Math.PI / 6),
        endY - 12 * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'tactical-unit':
      drawTacticalUnit(
        ctx,
        x,
        y,
        (data.unitType as TacticalUnitType) ?? 'fighter',
        (data.size as FormationSize) ?? 'flight',
        accentColor
      );
      break;
    case 'map-reference':
      ctx.strokeStyle = accentColor;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('M', x, y + 3);
      if (data.locationName) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(String(data.locationName), x + 12, y + 4);
      }
      break;
    default:
      ctx.beginPath();
      ctx.arc(x, y, Number(data.radius ?? 20), 0, 2 * Math.PI);
      ctx.stroke();
      break;
  }
};

// ============================================================================
// TacticalCanvas Component
// ============================================================================

export const TacticalCanvas: React.FC<TacticalCanvasProps> = ({
  briefing,
  onAddElement,
  onStatusChange,
  onCreateVersion,
  onClearCanvas,
  backgroundImageUrl,
  onBackgroundImageChange,
  currentPageIndex,
  pageCount,
  onPageChange,
  onAddPage,
  onDeletePage,
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<DrawingTool>('select');
  const [tacticalPlacement, setTacticalPlacement] = useState<TacticalPlacement>({
    unitType: 'fighter',
    size: 'flight',
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  // Load background image when URL changes
  useEffect(() => {
    if (!backgroundImageUrl) {
      setBgImage(null);
      return;
    }
    const img = new Image();
    img.onload = () => setBgImage(img);
    img.onerror = () => setBgImage(null);
    img.src = sanitizeImageUrl(backgroundImageUrl) || '';
  }, [backgroundImageUrl]);

  // Canvas rendering
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and fill background
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (bgImage) {
      // Draw image scaled to cover the canvas while preserving aspect ratio
      const imgAspect = bgImage.width / bgImage.height;
      const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;
      let drawWidth = CANVAS_WIDTH;
      let drawHeight = CANVAS_HEIGHT;
      let offsetX = 0;
      let offsetY = 0;
      if (imgAspect > canvasAspect) {
        drawHeight = CANVAS_HEIGHT;
        drawWidth = drawHeight * imgAspect;
        offsetX = (CANVAS_WIDTH - drawWidth) / 2;
      } else {
        drawWidth = CANVAS_WIDTH;
        drawHeight = drawWidth / imgAspect;
        offsetY = (CANVAS_HEIGHT - drawHeight) / 2;
      }
      ctx.drawImage(bgImage, offsetX, offsetY, drawWidth, drawHeight);

      // Semi-transparent overlay so drawn elements are visible
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawGrid(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(255, 255, 255, 0.15)');
    } else {
      ctx.fillStyle = theme.palette.background.default;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawGrid(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, theme.palette.divider);
    }

    for (const el of briefing.elements.filter(e => (e.pageIndex ?? 0) === currentPageIndex)) {
      drawElement(ctx, el, theme.palette.primary.main, theme.palette.warning.main);
    }
  }, [briefing.elements, theme, bgImage, currentPageIndex]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Canvas interaction
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) * CANVAS_WIDTH) / rect.width),
      y: Math.round(((e.clientY - rect.top) * CANVAS_HEIGHT) / rect.height),
    };
  };

  const placeElement = async (
    pos: { x: number; y: number },
    extraData?: Record<string, unknown>
  ) => {
    let elementData: Record<string, unknown> = { ...extraData };
    let elementType = tool as string;

    if (tool === 'text') {
      const text = prompt('Enter text label:');
      if (!text) return;
      elementData.text = text;
    }

    if (tool === 'tactical-unit') {
      elementType = 'tactical-unit';
      elementData = { unitType: tacticalPlacement.unitType, size: tacticalPlacement.size };
    }

    try {
      await onAddElement({
        type: elementType,
        position: pos,
        data: elementData,
        pageIndex: currentPageIndex,
      } as BriefingElement);
    } catch (err) {
      logger.error('Failed to place element', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select') return;
    const pos = getCanvasPos(e);
    setStartPos(pos);
    setIsDrawing(true);
    if (tool === 'marker' || tool === 'text' || tool === 'tactical-unit') {
      placeElement(pos);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const endPos = getCanvasPos(e);
    if (tool === 'line' || tool === 'arrow') {
      placeElement(startPos, { endX: endPos.x, endY: endPos.y });
    }
    setIsDrawing(false);
    setStartPos(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      logger.warn('Invalid image type', new Error(`Unsupported type: ${file.type}`));
      return;
    }

    // Max 5 MB
    if (file.size > 5 * 1024 * 1024) {
      logger.warn('Image too large', new Error(`File size: ${file.size}`));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onBackgroundImageChange?.(dataUrl);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.5 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {briefing.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              {(['draft', 'active', 'completed', 'archived'] as const).map(s => (
                <Chip
                  key={s}
                  label={s}
                  size="small"
                  color={STATUS_COLORS[s]}
                  variant={briefing.status === s ? 'filled' : 'outlined'}
                  onClick={() => onStatusChange(s)}
                  sx={{ cursor: 'pointer', textTransform: 'capitalize' }}
                />
              ))}
            </Box>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Create Version Snapshot">
              <IconButton size="small" onClick={onCreateVersion}>
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear Page">
              <IconButton size="small" onClick={onClearCanvas} color="error">
                <LayersClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Divider sx={{ mb: 1 }} />

        {/* Toolbar */}
        <Toolbar
          variant="dense"
          disableGutters
          sx={{ gap: 0.5, mb: 1, flexWrap: 'wrap', minHeight: 'auto' }}
        >
          <Tooltip title="Select / Move">
            <IconButton
              size="small"
              color={tool === 'select' ? 'primary' : 'default'}
              onClick={() => setTool('select')}
            >
              <NearMeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Marker">
            <Button
              size="small"
              variant={tool === 'marker' ? 'contained' : 'outlined'}
              onClick={() => setTool('marker')}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              &bull;
            </Button>
          </Tooltip>
          <Tooltip title="Text Label">
            <IconButton
              size="small"
              color={tool === 'text' ? 'primary' : 'default'}
              onClick={() => setTool('text')}
            >
              <TextFieldsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Line">
            <IconButton
              size="small"
              color={tool === 'line' ? 'primary' : 'default'}
              onClick={() => setTool('line')}
            >
              <TimelineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Arrow">
            <Button
              size="small"
              variant={tool === 'arrow' ? 'contained' : 'outlined'}
              onClick={() => setTool('arrow')}
              sx={{ minWidth: 'auto', px: 1, fontSize: '1rem' }}
            >
              &rarr;
            </Button>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Tooltip title="Place Tactical Unit">
            <IconButton
              size="small"
              color={tool === 'tactical-unit' ? 'warning' : 'default'}
              onClick={() => setTool('tactical-unit')}
            >
              <MilitaryTechIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Background image controls */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
            title="Upload background image"
          />
          <Tooltip title="Upload Background Image">
            <IconButton
              size="small"
              color={backgroundImageUrl ? 'success' : 'default'}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudUploadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {backgroundImageUrl && (
            <Tooltip title="Remove Background Image">
              <IconButton
                size="small"
                color="error"
                onClick={() => onBackgroundImageChange?.(null)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>

        {/* Tactical palette */}
        {tool === 'tactical-unit' && (
          <Box sx={{ mb: 1.5, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
            <TacticalIconPalette
              selectedUnit={tacticalPlacement.unitType}
              selectedSize={tacticalPlacement.size}
              onSelectUnit={u => setTacticalPlacement(p => ({ ...p, unitType: u }))}
              onSelectSize={s => setTacticalPlacement(p => ({ ...p, size: s }))}
            />
          </Box>
        )}

        {/* Canvas */}
        <Box
          sx={{
            position: 'relative',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'background.default',
            aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              ...(tool === 'select' ? CANVAS_STYLE_SELECT : CANVAS_STYLE_DRAW),
              position: 'relative',
              zIndex: 1,
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
        </Box>

        {/* Page navigation */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            mt: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <Tooltip title="Previous page">
            <span>
              <IconButton
                size="small"
                disabled={currentPageIndex === 0}
                onClick={() => onPageChange(currentPageIndex - 1)}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {Array.from({ length: pageCount }, (_, i) => (
            <Chip
              key={i}
              label={i + 1}
              size="small"
              color={i === currentPageIndex ? 'primary' : 'default'}
              variant={i === currentPageIndex ? 'filled' : 'outlined'}
              onClick={() => onPageChange(i)}
              sx={{ minWidth: 32, cursor: 'pointer' }}
            />
          ))}

          <Tooltip title="Next page">
            <span>
              <IconButton
                size="small"
                disabled={currentPageIndex >= pageCount - 1}
                onClick={() => onPageChange(currentPageIndex + 1)}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Tooltip title="Add page">
            <IconButton size="small" color="primary" onClick={onAddPage}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {pageCount > 1 && (
            <Tooltip title="Delete current page">
              <IconButton size="small" color="error" onClick={onDeletePage}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Page {currentPageIndex + 1} of {pageCount} &middot;{' '}
          {briefing.elements.filter(e => (e.pageIndex ?? 0) === currentPageIndex).length} elements
          &middot; Tool: {tool}
          {tool === 'tactical-unit' && ` (${tacticalPlacement.size} ${tacticalPlacement.unitType})`}
          {tool === 'line' || tool === 'arrow' ? ' \u2014 click & drag' : ' \u2014 click to place'}
        </Typography>
      </CardContent>
    </Card>
  );
};
