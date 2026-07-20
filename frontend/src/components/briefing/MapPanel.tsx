import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import MapIcon from '@mui/icons-material/Map';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';

import { InterdictionCalculator } from './InterdictionCalculator';
import {
  buildVerseGuideUrl,
  STAR_SYSTEMS,
  type StarSystem,
  type StarSystemLocation,
} from './locationData';

// ============================================================================
// Types
// ============================================================================

type MapSource = 'verseguide' | 'interdiction';

export interface MapPanelProps {
  /** Initial system selection */
  readonly initialSystem?: string;
  /** Initial location code */
  readonly initialLocation?: string;
  /** Height of the embedded iframe */
  readonly height?: number | string;
  /** Called when the user selects a location for briefing reference */
  readonly onLocationSelect?: (system: string, location: StarSystemLocation) => void;
}

// ============================================================================
// Helpers
// ============================================================================

const getLocationTypeChipColor = (
  type: StarSystemLocation['type']
): 'primary' | 'secondary' | 'info' | 'warning' | 'success' => {
  switch (type) {
    case 'star':
      return 'warning';
    case 'planet':
      return 'primary';
    case 'moon':
      return 'secondary';
    case 'station':
      return 'info';
    case 'lagrange':
      return 'success';
    default:
      return 'primary';
  }
};

// ============================================================================
// VerseGuideEmbed — extracted to avoid nested ternary
// ============================================================================

const VerseGuideEmbed: React.FC<{ mapUrl: string | null; height: number | string }> = ({
  mapUrl,
  height,
}) => {
  const theme = useTheme();

  if (mapUrl) {
    return (
      <Box
        component="iframe"
        src={mapUrl}
        title="VerseGuide Location Map"
        sx={{
          width: '100%',
          height: '100%',
          minHeight: height,
          border: 'none',
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: height,
        color: 'text.secondary',
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <MapIcon sx={{ fontSize: 48, opacity: 0.4, mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Select a location to view the map
        </Typography>
      </Box>
    </Box>
  );
};

// ============================================================================
// MapPanel Component
// ============================================================================

export const MapPanel: React.FC<MapPanelProps> = ({
  initialSystem,
  initialLocation,
  height = 500,
  onLocationSelect,
}) => {
  const [activeSource, setActiveSource] = useState<MapSource>('verseguide');
  const [selectedSystem, setSelectedSystem] = useState<StarSystem | undefined>(
    STAR_SYSTEMS.find(s => s.id === initialSystem) ?? STAR_SYSTEMS[0] ?? undefined
  );
  const [selectedLocation, setSelectedLocation] = useState<StarSystemLocation | undefined>(
    selectedSystem?.locations.find(l => l.code === initialLocation) ?? undefined
  );

  // Build grouped options for autocomplete
  const locationOptions: StarSystemLocation[] = selectedSystem
    ? [...selectedSystem.locations].sort((a, b) => {
        // Sort: planets first, then moons grouped by parent
        if (a.type === 'planet' && b.type !== 'planet') return -1;
        if (a.type !== 'planet' && b.type === 'planet') return 1;
        return a.name.localeCompare(b.name);
      })
    : [];

  const mapUrl =
    selectedSystem && selectedLocation
      ? buildVerseGuideUrl(selectedSystem.id, selectedLocation.code, selectedLocation.name)
      : null;

  const handleLocationChange = (_event: React.SyntheticEvent, value: StarSystemLocation | null) => {
    setSelectedLocation(value ?? undefined);
    if (value && selectedSystem && onLocationSelect) {
      onLocationSelect(selectedSystem.id, value);
    }
  };

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        {/* Source Toggle */}
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}
        >
          <ButtonGroup size="small" variant="outlined">
            <Button
              startIcon={<MapIcon />}
              variant={activeSource === 'verseguide' ? 'contained' : 'outlined'}
              onClick={() => setActiveSource('verseguide')}
            >
              VerseGuide Map
            </Button>
            <Button
              startIcon={<GpsFixedIcon />}
              variant={activeSource === 'interdiction' ? 'contained' : 'outlined'}
              onClick={() => setActiveSource('interdiction')}
            >
              Interdiction Planner
            </Button>
          </ButtonGroup>

          {/* Open in new tab (only for VerseGuide) */}
          {activeSource === 'verseguide' && mapUrl && (
            <Button
              size="small"
              endIcon={<OpenInNewIcon />}
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Full
            </Button>
          )}
        </Box>

        {/* VerseGuide Controls */}
        {activeSource === 'verseguide' && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* System Selector */}
            <Autocomplete<StarSystem, false, true>
              size="small"
              options={[...STAR_SYSTEMS]}
              getOptionLabel={s => s.name}
              value={selectedSystem ?? STAR_SYSTEMS[0]}
              onChange={(_e, val) => {
                setSelectedSystem(val ?? undefined);
                setSelectedLocation(undefined);
              }}
              sx={{ minWidth: 140 }}
              renderInput={params => <TextField {...params} label="System" />}
              disableClearable
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />

            {/* Location Selector */}
            <Autocomplete
              size="small"
              options={locationOptions}
              getOptionLabel={loc => (loc.parent ? `${loc.name} (${loc.parent})` : loc.name)}
              groupBy={loc => loc.parent ?? 'System'}
              value={selectedLocation ?? null}
              onChange={handleLocationChange}
              sx={{ minWidth: 220, flex: 1 }}
              renderInput={params => (
                <TextField {...params} label="Location" placeholder="Select a location..." />
              )}
              renderOption={(props, option) => {
                const { key, ...rest } = props;
                return (
                  <Box
                    component="li"
                    key={key}
                    {...rest}
                    sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                  >
                    <Chip
                      label={option.type}
                      size="small"
                      color={getLocationTypeChipColor(option.type)}
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                    <Typography variant="body2">{option.name}</Typography>
                  </Box>
                );
              }}
              isOptionEqualToValue={(option, value) => option.code === value.code}
            />
          </Box>
        )}
      </CardContent>

      {/* Embedded Map */}
      <Box sx={{ flex: 1, minHeight: height, position: 'relative' }}>
        {activeSource === 'verseguide' && <VerseGuideEmbed mapUrl={mapUrl} height={height} />}
        {activeSource === 'interdiction' && <InterdictionCalculator mapHeight={height} />}
      </Box>
    </Card>
  );
};
