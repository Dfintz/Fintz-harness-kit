/**
 * GuideLauncherButton — top-navigation entry point for Guide Mode.
 *
 * Renders nothing when used outside a GuideModeProvider so it stays safe in
 * isolated stories/tests that render the navigation on its own.
 */

import ExploreIcon from '@mui/icons-material/Explore';
import { IconButton, Tooltip } from '@mui/material';
import React from 'react';

import { useOptionalGuideMode } from './GuideMode';

export const GuideLauncherButton: React.FC = () => {
  const guide = useOptionalGuideMode();
  if (!guide) return null;

  return (
    <Tooltip title="Start guided tour (Shift + ?)">
      <IconButton
        onClick={() => guide.start()}
        className="action-button"
        aria-label="Start guided tour"
      >
        <ExploreIcon />
      </IconButton>
    </Tooltip>
  );
};
