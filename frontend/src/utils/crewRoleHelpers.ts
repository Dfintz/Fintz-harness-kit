/**
 * Crew role display helpers — reusable by CrewManagementDialog, ActivityDetail, JobPreviewModal.
 *
 * Provides consistent role colors, labels, and icons across all systems
 * that deal with ship crew positions.
 */

import {
  blue,
  brown,
  cyan,
  green,
  grey,
  indigo,
  lightGreen,
  orange,
  pink,
  purple,
  red,
} from '@mui/material/colors';
import { alpha } from '@mui/material/styles';
import type { CrewRole } from '@sc-fleet-manager/shared-types';

/** Role → display label */
export const CREW_ROLE_LABELS: Record<string, string> = {
  captain: 'Captain',
  pilot: 'Pilot',
  engineer: 'Engineer',
  gunner: 'Gunner',
  medic: 'Medic',
  medical: 'Medical',
  cargo: 'Cargo Specialist',
  navigator: 'Navigator',
  // Extended roles used by Activity / Job systems
  copilot: 'Co-Pilot',
  marine: 'Marine',
  scout: 'Scout',
  crew: 'Crew',
};

/** Role → primary color (for chips, badges) */
export const CREW_ROLE_COLORS: Record<string, string> = {
  captain: purple[500],
  pilot: blue[500],
  engineer: orange[500],
  gunner: red[500],
  medic: cyan[500],
  medical: cyan[500],
  cargo: brown[500],
  navigator: green[500],
  copilot: indigo[500],
  marine: pink[500],
  scout: lightGreen[500],
  crew: grey[500],
};

export function getRoleLabel(role: CrewRole | string): string {
  return (
    CREW_ROLE_LABELS[role] ||
    (typeof role === 'string' ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown')
  );
}

export function getRoleColor(role: CrewRole | string): string {
  return CREW_ROLE_COLORS[role] || grey[500];
}

export function getRoleBgColor(role: CrewRole | string): string {
  return alpha(getRoleColor(role), 0.12);
}

/** All crew roles as Select-friendly options */
export const CREW_ROLE_OPTIONS = Object.entries(CREW_ROLE_LABELS)
  .filter(([key]) =>
    ['captain', 'pilot', 'engineer', 'gunner', 'medic', 'cargo', 'navigator'].includes(key)
  )
  .map(([value, label]) => ({ value, label }));
