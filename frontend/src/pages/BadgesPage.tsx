/**
 * Badges Page
 *
 * Organization-level page for managing custom titles and badges.
 * Feature-flag gated: requires enableTitlesBadges on the org.
 */

import { BadgeManagementList } from '@/components/badges/BadgeManagementList';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import React from 'react';

export const BadgesPage: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Titles & Badges
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create and manage custom titles and badges for your organization members. Award
          achievements to recognize contributions, skills, and milestones.
        </Typography>
      </Box>
      <BadgeManagementList />
    </Container>
  );
};
