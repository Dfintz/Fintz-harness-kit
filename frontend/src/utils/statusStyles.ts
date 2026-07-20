/**
 * Centralized status badge/chip styling system.
 *
 * Replaces the 7+ distinct status color patterns scattered across the codebase
 * with a single utility that draws all colors from the MUI theme palette.
 *
 * Usage:
 *   import { getStatusChipSx } from '@/utils/statusStyles';
 *   <Chip label={status} sx={getStatusChipSx(status, theme)} size="small" />
 */

import type { SxProps, Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// ---------------------------------------------------------------------------
// Semantic status categories
// ---------------------------------------------------------------------------

type StatusCategory = 'positive' | 'active' | 'neutral' | 'warning' | 'negative' | 'info' | 'muted';

/** Map every known status string to a semantic category. */
const STATUS_CATEGORY: Record<string, StatusCategory> = {
  // Positive — completed, success
  completed: 'positive',
  returned: 'positive',
  approved: 'positive',
  connected: 'positive',
  active: 'positive',
  available: 'positive',
  online: 'positive',
  passed: 'positive',
  accepted: 'positive',
  resolved: 'positive',
  claimed: 'positive',
  enabled: 'positive',
  confirmed: 'positive',
  success: 'positive',
  replied: 'positive',

  // Active — in-progress work
  in_progress: 'active',
  recruiting: 'active',
  ready: 'active',
  open: 'active',
  escalated: 'active',

  // Neutral / info
  draft: 'info',
  neutral: 'neutral',
  planned: 'info',
  briefed: 'active',
  planning: 'info',
  pending: 'info',
  medium: 'info',
  submitted: 'info',
  standby: 'info',
  invited: 'info',
  awaiting_response: 'info',
  resynced: 'info',
  read: 'info',
  on_hold: 'neutral',

  // Warning — needs attention
  overdue: 'warning',
  expiring: 'warning',
  paused: 'warning',
  waitlisted: 'warning',
  reconnecting: 'warning',
  away: 'warning',
  busy: 'warning',

  // Negative — error states
  failed: 'negative',
  cancelled: 'negative',
  declined: 'negative',
  abandoned: 'negative',
  critical: 'negative',
  error: 'negative',
  offline: 'negative',
  rejected: 'negative',
  dismissed: 'negative',
  revoked: 'negative',
  removed: 'negative',
  disabled: 'negative',
  unavailable: 'negative',
  spam: 'negative',

  // Muted — expired, archived, inactive
  expired: 'muted',
  archived: 'muted',
  inactive: 'muted',
  deprecated: 'muted',
  disconnected: 'muted',
  closed: 'muted',

  // Team types (TeamTreeView)
  squad: 'info',
  division: 'warning',
  flight: 'positive',
  platoon: 'info',
  custom: 'muted',

  // Security levels (UserPermissionsDisplay) — level 1-10
  'security-level-1': 'positive',
  'security-level-2': 'positive',
  'security-level-3': 'positive',
  'security-level-4': 'warning',
  'security-level-5': 'warning',
  'security-level-6': 'warning',
  'security-level-7': 'negative',
  'security-level-8': 'negative',
  'security-level-9': 'negative',
  'security-level-10': 'negative',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns MUI `sx` props for a status Chip/badge that uses theme palette colors.
 *
 * Handles any status string — unknown strings default to the 'info' category.
 */
export function getStatusChipSx(status: string, theme: Theme): SxProps<Theme> {
  const category = STATUS_CATEGORY[status.toLowerCase()] ?? 'info';
  return getCategorySx(category, theme);
}

/**
 * Returns the semantic color (hex) for a status string.
 * Useful for icons, dots, or non-Chip elements.
 */
export function getStatusColor(status: string, theme: Theme): string {
  const category = STATUS_CATEGORY[status.toLowerCase()] ?? 'info';
  return getCategoryColor(category, theme);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getCategoryColor(category: StatusCategory, theme: Theme): string {
  switch (category) {
    case 'positive':
      return theme.palette.success.main;
    case 'active':
      return theme.palette.primary.main;
    case 'info':
      return theme.palette.info.main;
    case 'warning':
      return theme.palette.warning.main;
    case 'negative':
      return theme.palette.error.main;
    case 'muted':
      return theme.palette.text.disabled;
    case 'neutral':
    default:
      return theme.palette.text.secondary;
  }
}

function getCategorySx(category: StatusCategory, theme: Theme): SxProps<Theme> {
  const color = getCategoryColor(category, theme);
  const light = getCategoryLight(category, theme);

  return {
    bgcolor: alpha(color, 0.12),
    color: light,
    border: `1px solid ${alpha(color, 0.3)}`,
    fontWeight: 500,
    fontSize: '0.75rem',
  };
}

function getCategoryLight(category: StatusCategory, theme: Theme): string {
  switch (category) {
    case 'positive':
      return theme.palette.success.light;
    case 'active':
      return theme.palette.primary.light;
    case 'info':
      return theme.palette.info.light;
    case 'warning':
      return theme.palette.warning.light;
    case 'negative':
      return theme.palette.error.light;
    case 'muted':
      return theme.palette.text.disabled;
    case 'neutral':
    default:
      return theme.palette.text.secondary;
  }
}
