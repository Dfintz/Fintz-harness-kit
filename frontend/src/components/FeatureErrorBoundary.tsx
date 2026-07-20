import { errorTrackingService } from '@/services/errorTracking';
import { ErrorOutline as ErrorIcon } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  featureName: string;
  fallbackMessage?: string;
  showHomeButton?: boolean;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Feature-level Error Boundary Component
 *
 * Provides granular error handling for specific features/sections.
 * Unlike the global ErrorBoundary, this shows a smaller inline error UI
 * that doesn't take over the entire page, allowing other parts of the
 * application to continue working.
 *
 * Usage:
 * ```tsx
 * <FeatureErrorBoundary featureName="Fleet Management">
 *   <FleetManager />
 * </FeatureErrorBoundary>
 * ```
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Track error with feature context
    errorTrackingService.trackComponentError(
      error,
      errorInfo.componentStack || '',
      this.props.featureName
    );
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const { featureName, fallbackMessage, showHomeButton = false } = this.props;

      return (
        <Box
          sx={theme => ({
            p: 3,
            border: `1px solid ${theme.palette.error.main}`,
            borderRadius: '8px',
            backgroundColor: theme.palette.background.default,
          })}
        >
          <Stack direction="column" spacing={2} alignItems="center">
            <ErrorIcon sx={theme => ({ color: theme.palette.error.main, fontSize: 48 })} />

            <Typography variant="h6">{featureName} Error</Typography>

            <Typography sx={{ textAlign: 'center' }}>
              {fallbackMessage ||
                `An error occurred in the ${featureName} feature. Please try again or reload the page.`}
            </Typography>

            {import.meta.env.DEV && this.state.error && (
              <Box
                sx={theme => ({
                  backgroundColor: theme.palette.background.paper,
                  p: 1.5,
                  borderRadius: '4px',
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  overflow: 'auto',
                  maxHeight: '150px',
                })}
              >
                <Typography>
                  <strong>Error:</strong> {this.state.error.message}
                </Typography>
                {this.state.errorInfo && (
                  <Typography
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      mt: 0.5,
                      fontSize: '10px',
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </Typography>
                )}
              </Box>
            )}

            <Stack direction="row" spacing={1.5} flexWrap="wrap" justifyContent="center">
              <Button variant="contained" onClick={this.handleReset}>
                Try Again
              </Button>

              <Button variant="outlined" onClick={() => window.location.reload()}>
                Reload Page
              </Button>

              {showHomeButton && (
                <Button variant="outlined" onClick={this.handleGoHome}>
                  Go Home
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}
