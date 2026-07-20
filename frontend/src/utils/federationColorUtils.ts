import { Theme } from '@mui/material';

import { FederationRole } from '@/services/publicDirectoryService';

/**
 * Get the theme-derived role color for a federation membership role.
 * Used by PublicFederationCard, FederationDetailsPage, and FederationManagePage.
 */
export function getFederationRoleColor(role: FederationRole | string, theme: Theme): string {
  const colorMap: Record<string, string> = {
    founder: theme.palette.warning.main,
    leader: theme.palette.secondary.main,
    council: theme.palette.info.main,
    member: theme.palette.success.main,
    observer: theme.palette.text.disabled,
  };
  return colorMap[role] ?? theme.palette.text.disabled;
}

/**
 * Get a label for a shared resource type.
 * Used by PublicFederationCard and FederationDetailsPage.
 */
export function getResourceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    fleet: 'Fleet Resources',
    intel: 'Intelligence',
    routes: 'Trade Routes',
    discord: 'Discord Server',
    infrastructure: 'Infrastructure',
    other: 'Other Resources',
  };
  return labels[type] ?? type;
}
