import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Badge,
  Box,
  Button,
  Chip,
  Slider,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';

const REPUTATION_TIERS = [
  'Legendary',
  'Elite',
  'Veteran',
  'Experienced',
  'Reliable',
  'Average',
  'Developing',
  'Rookie',
] as const;

interface AdvancedFilters {
  minReputationScore?: number;
  reputationTiers: string[];
  minSuccessRate?: number;
}

interface AdvancedSearchFiltersPanelProps {
  filters: AdvancedFilters;
  onChange: (filters: AdvancedFilters) => void;
}

export const AdvancedSearchFiltersPanel: React.FC<Readonly<AdvancedSearchFiltersPanelProps>> = ({
  filters,
  onChange,
}) => {
  const theme = useTheme();

  const activeCount =
    (filters.minReputationScore !== undefined && filters.minReputationScore > 0 ? 1 : 0) +
    (filters.reputationTiers.length > 0 ? 1 : 0) +
    (filters.minSuccessRate !== undefined && filters.minSuccessRate > 0 ? 1 : 0);

  const handleReputationScoreChange = (_: Event, value: number | number[]) => {
    onChange({ ...filters, minReputationScore: value as number });
  };

  const handleSuccessRateChange = (_: Event, value: number | number[]) => {
    onChange({ ...filters, minSuccessRate: value as number });
  };

  const toggleTier = (tier: string) => {
    const tiers = filters.reputationTiers.includes(tier)
      ? filters.reputationTiers.filter(t => t !== tier)
      : [...filters.reputationTiers, tier];
    onChange({ ...filters, reputationTiers: tiers });
  };

  const clearAll = () => {
    onChange({
      minReputationScore: undefined,
      reputationTiers: [],
      minSuccessRate: undefined,
    });
  };

  return (
    <Accordion
      sx={{
        backgroundColor: theme.palette.background.paper,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Badge badgeContent={activeCount} color="primary">
            <TuneIcon />
          </Badge>
          <Typography variant="subtitle2">Advanced Filters</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          {/* Reputation Score */}
          <Box>
            <Typography variant="body2" gutterBottom>
              Minimum Reputation Score: {filters.minReputationScore ?? 0}
            </Typography>
            <Slider
              value={filters.minReputationScore ?? 0}
              onChange={handleReputationScoreChange}
              min={0}
              max={100}
              step={5}
              valueLabelDisplay="auto"
              marks={[
                { value: 0, label: '0' },
                { value: 50, label: '50' },
                { value: 100, label: '100' },
              ]}
            />
          </Box>

          {/* Reputation Tiers */}
          <Box>
            <Typography variant="body2" gutterBottom>
              Reputation Tiers
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {REPUTATION_TIERS.map(tier => (
                <Chip
                  key={tier}
                  label={tier}
                  size="small"
                  onClick={() => toggleTier(tier)}
                  variant={filters.reputationTiers.includes(tier) ? 'filled' : 'outlined'}
                  color={filters.reputationTiers.includes(tier) ? 'primary' : 'default'}
                />
              ))}
            </Stack>
          </Box>

          {/* Success Rate */}
          <Box>
            <Typography variant="body2" gutterBottom>
              Minimum Success Rate: {filters.minSuccessRate ?? 0}%
            </Typography>
            <Slider
              value={filters.minSuccessRate ?? 0}
              onChange={handleSuccessRateChange}
              min={0}
              max={100}
              step={5}
              valueLabelDisplay="auto"
              marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' },
              ]}
            />
          </Box>

          {/* Clear button */}
          {activeCount > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={clearAll}
              sx={{ alignSelf: 'flex-start' }}
            >
              Clear Advanced Filters
            </Button>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
