/**
 * Changelog Preview
 *
 * Landing page section showing the latest release notes to visitors.
 */

import NewReleasesIcon from '@mui/icons-material/NewReleases';
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { changelogEntries } from '@/data/changelogContent';

const categoryColors: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  added: 'success',
  improved: 'info',
  fixed: 'warning',
  removed: 'error',
};

export const ChangelogPreview: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Show the 3 most recent entries
  const recentEntries = changelogEntries.slice(0, 3);

  return (
    <Box sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Stack spacing={4} alignItems="center">
          {/* Section header */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <NewReleasesIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                fontSize: { xs: '1.5rem', md: '2rem' },
              }}
            >
              What&apos;s New
            </Typography>
          </Stack>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 600 }}
          >
            Fringe Core is actively developed with frequent updates. Here are the latest changes.
          </Typography>

          {/* Recent entries */}
          <Grid container spacing={3} sx={{ width: '100%' }}>
            {recentEntries.map(entry => (
              <Grid key={entry.version} size={{ xs: 12, md: 4 }}>
                <Box
                  sx={{
                    borderRadius: 2,
                    p: 3,
                    height: '100%',
                    background: alpha(theme.palette.background.default, 0.6),
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    transition: 'border-color 0.2s',
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={entry.version} size="small" color="primary" variant="outlined" />
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                    </Stack>

                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {entry.title}
                    </Typography>

                    <List dense disablePadding>
                      {entry.highlights.slice(0, 2).map(highlight => (
                        <ListItem
                          key={highlight}
                          disableGutters
                          sx={{ py: 0.25, alignItems: 'flex-start' }}
                        >
                          <ListItemIcon sx={{ minWidth: 24, mt: 0.5 }}>
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: 'primary.main',
                              }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={highlight}
                            slotProps={{
                              primary: {
                                variant: 'body2',
                                color: 'text.secondary',
                                sx: {
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                },
                              },
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>

                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {entry.changes.map(change => (
                        <Chip
                          key={change.category}
                          label={`${change.items.length} ${change.category}`}
                          size="small"
                          color={categoryColors[change.category] ?? 'default'}
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* View all button */}
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/changelog')}
            sx={{
              px: 4,
              py: 1.5,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            View Full Changelog
          </Button>
        </Stack>
      </Container>
    </Box>
  );
};
