/**
 * Permission Error Alert Component
 *
 * Displays permission denial information in a user-friendly format with:
 * - Required permission details (resource:action)
 * - Actionable next steps
 * - Contact admin option
 *
 * Part of R-5: Permission Error Enrichment Sprint
 *
 * @example
 * ```typescript
 * import { PermissionErrorAlert } from '@/components/PermissionErrorAlert';
 * import { isApiClientError } from '@/services/apiClient';
 *
 * try {
 *   await fleetService.updateFleet(fleetId, data);
 * } catch (error) {
 *   if (isApiClientError(error) && error.statusCode === 403) {
 *     return <PermissionErrorAlert error={error} onContactAdmin={handleContactAdmin} />;
 *   }
 * }
 * ```
 */

import { ApiClientError } from '@/services/apiClient';
import { HelpOutline as HelpIcon, Person as PersonIcon } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';

interface PermissionContext {
  resource: string;
  action: string;
  scope?: string;
  resourceId?: string;
}

interface PermissionErrorAlertProps {
  /** Error object from apiClient containing permission context */
  error: ApiClientError;

  /** Optional custom title override */
  title?: string;

  /** Optional custom message override */
  message?: string;

  /** Optional callback when user wants to contact admin */
  onContactAdmin?: () => void;

  /** Optional callback when user dismisses the alert */
  onDismiss?: () => void;

  /** Optional contact email or link */
  contactEmail?: string;

  /** Whether to show help dialog option */
  showHelpOption?: boolean;

  /** Custom CSS class for styling */
  className?: string;
}

/**
 * Extract permission context from error details
 */
export function extractPermissionContext(error: ApiClientError): PermissionContext | null {
  if (error.statusCode !== 403 || !error.details) {
    return null;
  }

  const permission = (error.details as Record<string, unknown>).permission as
    | PermissionContext
    | undefined;
  return permission || null;
}

/**
 * Format permission key to human-readable text
 */
export function formatPermissionKey(resource: string, action: string): string {
  const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);
  const actionName = action.charAt(0).toUpperCase() + action.slice(1);
  return `${resourceName}: ${actionName}`;
}

/**
 * Permission Error Alert Component
 *
 * Displays detailed permission denial information extracted from API errors
 */
export const PermissionErrorAlert: React.FC<Readonly<PermissionErrorAlertProps>> = ({
  error,
  title = 'Access Denied',
  message,
  onContactAdmin,
  onDismiss,
  contactEmail = 'admin@example.com',
  showHelpOption = true,
  className,
}) => {
  const theme = useTheme();
  const [showHelp, setShowHelp] = useState(false);
  const permissionContext = extractPermissionContext(error);

  // If no permission context, show generic error
  if (!permissionContext) {
    return (
      <Alert severity="error" onClose={onDismiss} sx={{ mb: 2 }} className={className}>
        <AlertTitle>{title}</AlertTitle>
        {message || error.message || 'You do not have permission to perform this action.'}
      </Alert>
    );
  }

  const formattedPermission = formatPermissionKey(
    permissionContext.resource,
    permissionContext.action
  );

  return (
    <>
      <Alert severity="error" onClose={onDismiss} sx={{ mb: 2 }} className={className}>
        <AlertTitle>{title}</AlertTitle>

        <Stack spacing={1.5}>
          {/* Error message */}
          <Typography variant="body2">
            {message || error.message || 'You do not have permission to perform this action.'}
          </Typography>

          {/* Permission details */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="body2"
              sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}
            >
              Required permission:
            </Typography>
            <Chip
              label={formattedPermission}
              size="small"
              variant="outlined"
              sx={{
                backgroundColor: theme.palette.error.light,
                color: theme.palette.error.dark,
                borderColor: theme.palette.error.main,
                fontWeight: 600,
              }}
            />
          </Box>

          {/* Action buttons */}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {onContactAdmin && (
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={onContactAdmin}
                startIcon={<PersonIcon />}
              >
                Request Access
              </Button>
            )}

            {showHelpOption && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowHelp(true)}
                startIcon={<HelpIcon />}
              >
                Learn More
              </Button>
            )}

            {contactEmail && (
              <Button
                size="small"
                variant="text"
                component="a"
                href={`mailto:${contactEmail}?subject=Permission%20Request%20-%20${permissionContext.resource}`}
              >
                Email Admin
              </Button>
            )}
          </Stack>
        </Stack>
      </Alert>

      {/* Help Dialog */}
      {showHelpOption && (
        <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Permission Denied – How to Get Access</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  What is this permission?
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  The{' '}
                  <Chip
                    label={formattedPermission}
                    size="small"
                    variant="outlined"
                    sx={{ mx: 0.5, height: 20 }}
                  />{' '}
                  permission allows users to{' '}
                  <strong>
                    {permissionContext.action} {permissionContext.resource}s
                  </strong>{' '}
                  in your organization.
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  How to request access
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Contact your organization administrator to request the{' '}
                  <strong>{permissionContext.action}</strong> permission for{' '}
                  <strong>{permissionContext.resource}</strong>. Your request should include:
                </Typography>
                <Box sx={{ pl: 2, mt: 1 }}>
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ color: theme.palette.text.secondary }}
                  >
                    • Why you need this permission
                  </Typography>
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ color: theme.palette.text.secondary }}
                  >
                    • What you plan to use it for
                  </Typography>
                  {permissionContext.resourceId && (
                    <Typography
                      variant="body2"
                      component="div"
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      • Resource ID: <code>{permissionContext.resourceId}</code>
                    </Typography>
                  )}
                </Box>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Common permissions
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  • <strong>Fleet: View</strong> – See fleet details and members
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  • <strong>Fleet: Edit</strong> – Modify fleet settings and composition
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  • <strong>Fleet: Delete</strong> – Remove fleets from your organization
                </Typography>
              </Box>

              {contactEmail && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Contact your admin
                  </Typography>
                  <Link
                    href={`mailto:${contactEmail}?subject=Permission%20Request%20-%20${permissionContext.resource}`}
                    variant="body2"
                  >
                    {contactEmail}
                  </Link>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowHelp(false)} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};
