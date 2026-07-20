import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import React from 'react';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

import { InterdictionCalculator } from './InterdictionCalculator';

// ============================================================================
// InterdictionPlannerPage — Standalone page for the QED interdiction planner
// ============================================================================

export const InterdictionPlannerPage: React.FC = () => {
  const theme = useTheme();

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="h5" fontWeight={600}>
        Interdiction Planner
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Plan optimal QED-Snare placement to interdict quantum travel routes. Select where a target
        might depart from and where they are heading, then calculate the best snare position.
      </Typography>

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.grey[900], 0.5) : 'grey.50',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" fontWeight={600}>
            How Quantum Interdiction Works
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Typography variant="body2" color="text.secondary" component="div">
            <Box component="p" sx={{ mt: 0, mb: 1 }}>
              Ships in Star Citizen travel between locations using <strong>quantum travel</strong> —
              a straight-line high-speed drive that follows a fixed path between origin and
              destination. A <strong>QED-Snare</strong> (Quantum Enforcement Device) creates a
              spherical interdiction zone that pulls ships out of quantum when they pass through it.
            </Box>
            <Box component="p" sx={{ mt: 0, mb: 1.5 }}>
              Ships approaching a snare will be yanked out of quantum travel and arrive near the
              snare position. The key to effective interdiction is placing the snare so its radius
              covers <em>all possible quantum routes</em> the target might take.
            </Box>

            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Using the Planner
            </Typography>
            <Box component="ol" sx={{ mt: 0, pl: 2.5, mb: 1.5 }}>
              <li>
                Select a <strong>system</strong> (Stanton, Pyro, or Nyx) using the tabs at the top.
              </li>
              <li>
                Set the selection mode to{' '}
                <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>
                  Origin
                </Box>{' '}
                and click one or more locations where the target might depart from.
              </li>
              <li>
                Switch to{' '}
                <Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>
                  Destination
                </Box>{' '}
                and click where the target is heading.
              </li>
              <li>
                Adjust the <strong>QED-Snare range</strong> slider to match your snare device's
                effective radius.
              </li>
              <li>
                Click <strong>Calculate</strong> to find the optimal snare position.
              </li>
            </Box>

            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Reading the Results
            </Typography>
            <Box component="ul" sx={{ mt: 0, pl: 2.5, mb: 1.5 }}>
              <li>
                <strong>VIABLE</strong> — the snare covers all quantum routes at the calculated
                position. Ships from any selected origin will be pulled out of QT.
              </li>
              <li>
                <strong>NOT VIABLE</strong> — the route spread is too wide for the snare radius.
                Reduce origins, pick closer origins, or increase QED range.
              </li>
              <li>
                <strong>Dashed perpendicular lines</strong> show the distance from the snare center
                to each route. Green means within range; red means out of range.
              </li>
              <li>
                <strong>Distance labels</strong> on each perpendicular line show the exact distance.
                The snare catches any route whose perpendicular distance is within the QED range.
              </li>
            </Box>

            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Tips for Effective Interdiction
            </Typography>
            <Box component="ul" sx={{ mt: 0, pl: 2.5, mb: 0 }}>
              <li>
                Targets travelling from origins that are <strong>close together</strong> produce a
                narrow route fan — easier to cover with a single snare.
              </li>
              <li>
                Place the snare <strong>closer to the destination</strong> if routes converge there,
                or further out if they fan apart quickly.
              </li>
              <li>
                Jump points (blue diamonds) can be used as origins or destinations for cross-system
                interdiction planning.
              </li>
              <li>
                Use the <strong>Export</strong> button to save the map as a PNG for sharing in
                briefings or Discord.
              </li>
            </Box>
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <InterdictionCalculator mapHeight="calc(100vh - 260px)" />
      </Box>
    </Box>
  );
};

export const InterdictionPlannerPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Interdiction Planner">
    <InterdictionPlannerPage />
  </FeatureErrorBoundary>
);
