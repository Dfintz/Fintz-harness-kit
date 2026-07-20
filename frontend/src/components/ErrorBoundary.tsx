import { errorTrackingService } from '@/services/errorTracking';
import { Home as HomeIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { Component, ErrorInfo, ReactNode } from 'react';
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and display errors gracefully
 * Prevents the entire application from crashing when a component error occurs
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Error tracking service will handle logging
    this.setState({
      error,
      errorInfo,
    });

    // Track error with error tracking service (which logs in development)
    errorTrackingService.trackComponentError(
      error,
      errorInfo.componentStack || '',
      'ErrorBoundary'
    );
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, width: '100%', height: '100vh' }}>
          <Stack
            direction="column"
            gap={3}
            alignItems="center"
            justifyContent="center"
            height="100%"
          >
            <Alert severity="error">Something went wrong</Alert>
            <Typography variant="h4">Something went wrong</Typography>
            <Typography sx={{ textAlign: 'center', maxWidth: '600px' }}>
              An unexpected error occurred. The error has been logged and we're working on fixing
              it. Please try refreshing the page.
            </Typography>

            {import.meta.env.DEV && this.state.error && (
              <Box
                sx={{
                  backgroundColor: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  width: '100%',
                  maxWidth: '800px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '300px',
                }}
              >
                <Typography variant="body2">
                  <strong>Error:</strong> {this.state.error.message}
                </Typography>
                {this.state.errorInfo && (
                  <Typography variant="body2" component="div">
                    <br />
                    <strong>Stack:</strong>
                    <pre style={{ whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </Typography>
                )}
              </Box>
            )}

            <Stack gap={2} flexWrap="wrap" justifyContent="center" direction="row">
              <Button variant="contained" color="primary" onClick={this.handleReset}>
                <RefreshIcon sx={{ mr: 1 }} />
                Try Again
              </Button>
              <Button variant="outlined" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
              <Button variant="outlined" onClick={this.handleGoHome}>
                <HomeIcon sx={{ mr: 1 }} />
                Go Home
              </Button>
            </Stack>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}
