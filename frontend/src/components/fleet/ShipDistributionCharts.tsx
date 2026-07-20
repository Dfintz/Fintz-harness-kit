import {
  formatShipLabel,
  getCareerColor,
  getRoleColor,
  getSizeColor,
} from '@/utils/shipColorUtils';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import React, { useMemo } from 'react';
import { Pie, PieChart, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

/* ---------- chart data helper ---------- */

function toChartData(
  record: Record<string, number> | undefined,
  colorFn: (key: string, t: Theme) => string,
  t: Theme
) {
  if (!record) return [];
  return Object.entries(record)
    .filter(([key, v]) => v > 0 && key.toLowerCase() !== 'unknown')
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: formatShipLabel(key),
      value,
      fill: colorFn(key, t),
    }));
}

/* ---------- custom legend ---------- */

interface LegendEntry {
  readonly name: string;
  readonly value: number;
  readonly fill: string;
}

const ChartLegend: React.FC<{ readonly entries: readonly LegendEntry[] }> = ({ entries }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: entries.length > 6 ? 'repeat(2, 1fr)' : '1fr',
      gap: 0.25,
      mt: 1,
      maxHeight: entries.length > 10 ? 120 : 'none',
      overflow: entries.length > 10 ? 'auto' : 'visible',
    }}
  >
    {entries.map(entry => (
      <Box
        key={entry.name}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          py: 0.125,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: entry.fill,
            flexShrink: 0,
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.name}
          <Box component="span" sx={{ fontWeight: 600, ml: 0.5, color: 'text.primary' }}>
            {entry.value}
          </Box>
        </Typography>
      </Box>
    ))}
  </Box>
);

/* ---------- single chart card ---------- */

interface ChartCardProps {
  readonly title: string;
  readonly data: LegendEntry[];
}

const ChartCard: React.FC<ChartCardProps> = ({ title, data }) => {
  const theme = useTheme();

  if (data.length === 0) return null;

  return (
    <Card
      sx={{
        flex: '1 1 300px',
        minWidth: 280,
        maxWidth: 420,
        backgroundColor: alpha(theme.palette.background.paper, 0.6),
      }}
    >
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {title}
        </Typography>
        <Box sx={{ width: '100%', height: 180 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                stroke="none"
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 4,
                  color: theme.palette.text.primary,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
        <ChartLegend entries={data} />
      </CardContent>
    </Card>
  );
};

/* ---------- public component ---------- */

export interface ShipDistributionChartsProps {
  readonly summary: {
    byCareer?: Record<string, number>;
    byRole?: Record<string, number>;
    bySize?: Record<string, number>;
  };
}

export const ShipDistributionCharts: React.FC<ShipDistributionChartsProps> = ({ summary }) => {
  const theme = useTheme();
  const careerData = useMemo(
    () => toChartData(summary.byCareer, getCareerColor, theme),
    [summary.byCareer, theme]
  );
  const roleData = useMemo(
    () => toChartData(summary.byRole, getRoleColor, theme),
    [summary.byRole, theme]
  );
  const sizeData = useMemo(
    () => toChartData(summary.bySize, getSizeColor, theme),
    [summary.bySize, theme]
  );

  if (careerData.length === 0 && roleData.length === 0 && sizeData.length === 0) return null;

  return (
    <Stack direction="row" gap={2} flexWrap="wrap" alignItems="flex-start">
      <ChartCard title="Ships by Career" data={careerData} />
      <ChartCard title="Ships by Role" data={roleData} />
      <ChartCard title="Ships by Size" data={sizeData} />
    </Stack>
  );
};
