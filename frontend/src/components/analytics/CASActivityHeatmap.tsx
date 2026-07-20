/**
 * CASActivityHeatmap — 7x24 activity heatmap grid.
 *
 * Uses MUI Grid + themed Box cells. No Recharts (no built-in heatmap).
 * Color interpolation via CSS color-mix() — no hardcoded hex colors.
 * Explicit dimensions per cell to avoid layout issues.
 */

import { useCASHeatmap } from '@/hooks/queries/useCASQueries';
import { Box, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { type Theme, useTheme } from '@mui/material/styles';
import React from 'react';

interface CASActivityHeatmapProps {
  organizationId: string;
  days?: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getCellColor = (intensity: number, theme: Theme): string => {
  const cold = theme.palette.action.disabledBackground;
  const hot = theme.palette.primary.main;
  const hotPercent = Math.round(Math.max(0, Math.min(1, intensity)) * 100);
  return `color-mix(in srgb, ${cold} ${100 - hotPercent}%, ${hot} ${hotPercent}%)`;
};

export const CASActivityHeatmap: React.FC<Readonly<CASActivityHeatmapProps>> = ({
  organizationId,
  days = 7,
}) => {
  const theme = useTheme();
  const { data, isLoading } = useCASHeatmap(organizationId, days);

  if (isLoading) {
    return <Skeleton variant="rounded" height={200} />;
  }

  if (!data || data.cells.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Activity heatmap will appear after 24 hours of data collection.
      </Typography>
    );
  }

  // Build grid: 7 rows (days) x 24 columns (hours)
  const grid = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) =>
      data.cells.find(c => c.dayOfWeek === day && c.hour === hour)
    )
  );

  return (
    <Stack gap={0.5}>
      {/* Hour labels */}
      <Stack direction="row" sx={{ ml: '40px' }}>
        {Array.from({ length: 24 }, (_, h) => (
          <Typography
            key={h}
            variant="caption"
            sx={{
              width: '100%',
              textAlign: 'center',
              fontSize: '0.6rem',
              color: 'text.disabled',
              display: h % 3 === 0 ? 'block' : 'none',
            }}
          >
            {h.toString().padStart(2, '0')}
          </Typography>
        ))}
      </Stack>

      {/* Grid rows */}
      {grid.map((row, dayIndex) => (
        <Stack key={dayIndex} direction="row" alignItems="center" gap={0.25}>
          <Typography
            variant="caption"
            sx={{ width: 36, textAlign: 'right', pr: 0.5, color: 'text.secondary', fontSize: '0.7rem' }}
          >
            {DAY_LABELS[dayIndex]}
          </Typography>
          {row.map((cell, hourIndex) => (
            <Tooltip
              key={hourIndex}
              title={
                cell
                  ? `${DAY_LABELS[dayIndex]} ${hourIndex}:00–${hourIndex + 1}:00\nPresence: ${cell.avgPresence.toFixed(0)}\nSite: ${cell.avgSiteActive.toFixed(0)}\nScore: ${cell.rawPerCapita.toFixed(1)}`
                  : `${DAY_LABELS[dayIndex]} ${hourIndex}:00 — No data`
              }
              placement="top"
              arrow
            >
              <Box
                sx={{
                  flex: 1,
                  minWidth: 8,
                  height: 20,
                  borderRadius: 0.5,
                  backgroundColor: cell
                    ? getCellColor(cell.intensity, theme)
                    : theme.palette.action.disabledBackground,
                  transition: 'background-color 0.2s',
                  '&:hover': { outline: `1px solid ${theme.palette.primary.light}` },
                }}
              />
            </Tooltip>
          ))}
        </Stack>
      ))}

      {/* Legend */}
      <Stack direction="row" justifyContent="flex-end" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.disabled">Less</Typography>
        {[0, 0.25, 0.5, 0.75, 1.0].map(v => (
          <Box
            key={v}
            sx={{
              width: 12,
              height: 12,
              borderRadius: 0.5,
              backgroundColor: getCellColor(v, theme),
            }}
          />
        ))}
        <Typography variant="caption" color="text.disabled">More</Typography>
      </Stack>
    </Stack>
  );
};
