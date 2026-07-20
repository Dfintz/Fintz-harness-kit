import { Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import React from 'react';

export const NotificationsPage: React.FC = () => {
  const notifications = [
    { id: '1', title: 'Welcome to Fringe Core', body: 'Explore features and set up your org.' },
    { id: '2', title: 'System Update', body: 'Minor improvements and bug fixes deployed.' },
  ];

  return (
    <Box p={3}>
      <Typography variant="h5" component="h1" gutterBottom>
        Notifications
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Your latest updates and system messages.
      </Typography>
      <List>
        {notifications.map(n => (
          <ListItem key={n.id} divider>
            <ListItemText primary={n.title} secondary={n.body} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const NotificationsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Notifications">
    <NotificationsPage />
  </FeatureErrorBoundary>
);
