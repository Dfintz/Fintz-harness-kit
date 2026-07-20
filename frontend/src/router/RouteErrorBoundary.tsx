/**
 * Route Error Boundary
 *
 * Error boundary component for React Router routes.
 * Catches and displays errors from route loaders and components.
 * Detects stale-chunk failures (post-deployment 404s) and offers a reload.
 */

import {
  ArrowBack as BackIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import React from 'react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';

import { isChunkLoadError } from '@/utils/retryLazy';

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  const chunkError = isChunkLoadError(error);

  let errorMessage = 'An unexpected error occurred';
  let errorStatus = 500;

  if (chunkError) {
    errorMessage =
      'A new version of the app has been deployed. Please reload to get the latest version.';
  } else if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.data || error.statusText;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <Stack
      direction="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={3}
      sx={theme => ({
        p: 4,
        backgroundColor: theme.palette.background.default,
      })}
    >
      <Alert severity={chunkError ? 'info' : 'error'}>
        {chunkError ? 'Update Available' : `Error ${errorStatus}`}
      </Alert>

      <Typography variant="h4">
        {chunkError
          ? 'New Version Available'
          : errorStatus === 404
            ? 'Page Not Found' // eslint-disable-line no-nested-ternary
            : 'Something Went Wrong'}
      </Typography>

      <Typography>
        {errorStatus === 404 && !chunkError
          ? 'The page you are looking for does not exist.'
          : errorMessage}
      </Typography>

      <Stack gap={2} direction="row" flexWrap="wrap" justifyContent="center">
        {chunkError ? (
          <Button variant="contained" color="primary" onClick={() => globalThis.location.reload()}>
            <RefreshIcon sx={{ mr: 1 }} />
            Reload Page
          </Button>
        ) : (
          <Button variant="contained" color="primary" onClick={() => navigate(-1)}>
            <BackIcon sx={{ mr: 1 }} />
            Go Back
          </Button>
        )}

        <Button variant="outlined" onClick={() => navigate('/')}>
          <HomeIcon sx={{ mr: 1 }} />
          Go Home
        </Button>
      </Stack>

      {process.env.NODE_ENV === 'development' && error instanceof Error && (
        <Box
          sx={theme => ({
            p: 3,
            border: `1px solid ${theme.palette.error.main}`,
            borderRadius: 1,
            maxWidth: '800px',
            mt: 4,
            fontFamily: 'monospace',
            fontSize: '14px',
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
            backgroundColor: theme.palette.background.paper,
          })}
        >
          <Typography variant="subtitle2">
            <strong>Error Details (Development Only):</strong>
          </Typography>
          <Typography variant="body2" sx={theme => ({ color: theme.palette.error.dark, mt: 1 })}>
            {error.stack}
          </Typography>
        </Box>
      )}
    </Stack>
  );
};
