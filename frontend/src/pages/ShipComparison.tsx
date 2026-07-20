import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { useCompareShips } from '@/hooks/queries/useShipComparisonQueries';
import { useShips } from '@/hooks/queries/useShipQueries';

const ShipComparison: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    data: shipsResponse,
    isLoading: shipsLoading,
    error: shipsError,
  } = useShips({
    page: 1,
    limit: 200,
  });

  const ships = useMemo(() => shipsResponse?.items || [], [shipsResponse]);

  const {
    data: comparison,
    isLoading: comparisonLoading,
    error: comparisonError,
  } = useCompareShips(selectedIds);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: 2, py: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <CompareArrowsIcon color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Ship Comparison
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select at least two ships to compare performance, utility, and role strengths.
          </Typography>
        </Box>
      </Stack>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <FormControl fullWidth>
            <InputLabel id="ship-comparison-select-label">Ships</InputLabel>
            <Select<string[]>
              labelId="ship-comparison-select-label"
              multiple
              value={selectedIds}
              label="Ships"
              onChange={event => {
                const value = event.target.value;
                setSelectedIds(typeof value === 'string' ? value.split(',') : value);
              }}
              renderValue={selected => {
                const selectedNames = ships
                  .filter(ship => selected.includes(ship.id))
                  .map(ship => ship.name);
                return selectedNames.join(', ');
              }}
            >
              {ships.map(ship => (
                <MenuItem key={ship.id} value={ship.id}>
                  {ship.name} {ship.manufacturer ? `- ${ship.manufacturer}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
            {selectedIds.map(id => {
              const ship = ships.find(s => s.id === id);
              return <Chip key={id} label={ship?.name || id} size="small" />;
            })}
          </Stack>
        </CardContent>
      </Card>

      {shipsLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {shipsError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load ships for comparison.
        </Alert>
      )}

      {comparisonLoading && selectedIds.length >= 2 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {comparisonError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to compare selected ships.
        </Alert>
      )}

      {comparison && (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {comparison.ships.map(entry => (
            <Grid key={entry.ship.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6">{entry.ship.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {entry.ship.manufacturer || 'Unknown manufacturer'}
                  </Typography>

                  <Stack spacing={1}>
                    <Typography variant="body2">Combat: {entry.scores.combat}</Typography>
                    <Typography variant="body2">Cargo: {entry.scores.cargo}</Typography>
                    <Typography variant="body2">Speed: {entry.scores.speed}</Typography>
                    <Typography variant="body2">Crew: {entry.scores.crew}</Typography>
                    <Typography variant="body2">Value: {entry.scores.value}</Typography>
                    <Typography variant="subtitle2">Overall: {entry.scores.overall}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {comparison.summary.recommendations.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Recommendations
                  </Typography>
                  <Stack spacing={0.75}>
                    {comparison.summary.recommendations.map(rec => (
                      <Typography key={`${rec.shipId}-${rec.strength}`} variant="body2">
                        <strong>{rec.shipName}</strong>: {rec.reason}
                      </Typography>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export const ShipComparisonWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Ship Comparison">
    <ShipComparison />
  </FeatureErrorBoundary>
);

export { ShipComparison };
