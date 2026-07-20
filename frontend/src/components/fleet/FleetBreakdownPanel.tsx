import {
  formatShipLabel,
  getCareerColor,
  getManufacturerColor,
  getRoleColor,
  getSizeColor,
} from '@/utils/shipColorUtils';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import React from 'react';

/* ---------- chip row ---------- */

interface BreakdownChipsProps {
  readonly data: Record<string, number>;
  readonly colorFn: (key: string, theme: Theme) => string;
  readonly onFilter?: (key: string) => void;
}

const BreakdownChips: React.FC<BreakdownChipsProps> = ({ data, colorFn, onFilter }) => {
  const theme = useTheme();
  const sorted = Object.entries(data)
    .filter(([key]) => key.toLowerCase() !== 'unknown')
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) return null;

  return (
    <Stack direction="row" gap={1} flexWrap="wrap">
      {sorted.map(([key, count]) => {
        const color = colorFn(key, theme);
        return (
          <Chip
            key={key}
            label={`${formatShipLabel(key)}: ${count}`}
            size="small"
            onClick={onFilter ? () => onFilter(key) : undefined}
            sx={{
              backgroundColor: alpha(color, 0.13),
              color,
              fontWeight: 500,
              cursor: onFilter ? 'pointer' : 'default',
            }}
          />
        );
      })}
    </Stack>
  );
};

/* ---------- section wrapper ---------- */

interface BreakdownSectionProps {
  readonly title: string;
  readonly data: Record<string, number>;
  readonly colorFn: (key: string, theme: Theme) => string;
  readonly onFilter?: (key: string) => void;
}

const BreakdownSection: React.FC<BreakdownSectionProps> = ({ title, data, colorFn, onFilter }) => {
  if (Object.keys(data).length === 0) return null;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <BreakdownChips data={data} colorFn={colorFn} onFilter={onFilter} />
    </Box>
  );
};

/* ---------- public panel ---------- */

export interface FleetBreakdownData {
  byCareer?: Record<string, number>;
  byRole?: Record<string, number>;
  bySize?: Record<string, number>;
  byManufacturer?: Record<string, number>;
}

interface FleetBreakdownPanelProps {
  readonly data: FleetBreakdownData;
  readonly onCareerFilter?: (career: string) => void;
  readonly onRoleFilter?: (role: string) => void;
  readonly onSizeFilter?: (size: string) => void;
  readonly onManufacturerFilter?: (manufacturer: string) => void;
}

export const FleetBreakdownPanel: React.FC<FleetBreakdownPanelProps> = ({
  data,
  onCareerFilter,
  onRoleFilter,
  onSizeFilter,
  onManufacturerFilter,
}) => {
  const hasCareer = data.byCareer && Object.keys(data.byCareer).length > 0;
  const hasRole = data.byRole && Object.keys(data.byRole).length > 0;
  const hasSize = data.bySize && Object.keys(data.bySize).length > 0;
  const hasMfr = data.byManufacturer && Object.keys(data.byManufacturer).length > 0;

  if (!hasCareer && !hasRole && !hasSize && !hasMfr) return null;

  return (
    <Stack gap={1.5}>
      {hasCareer && (
        <BreakdownSection
          title="By Career"
          data={data.byCareer!}
          colorFn={getCareerColor}
          onFilter={onCareerFilter}
        />
      )}
      {hasRole && (
        <BreakdownSection
          title="By Role"
          data={data.byRole!}
          colorFn={getRoleColor}
          onFilter={onRoleFilter}
        />
      )}
      {hasSize && (
        <BreakdownSection
          title="By Size"
          data={data.bySize!}
          colorFn={getSizeColor}
          onFilter={onSizeFilter}
        />
      )}
      {hasMfr && (
        <BreakdownSection
          title="By Manufacturer"
          data={data.byManufacturer!}
          colorFn={getManufacturerColor}
          onFilter={onManufacturerFilter}
        />
      )}
    </Stack>
  );
};
