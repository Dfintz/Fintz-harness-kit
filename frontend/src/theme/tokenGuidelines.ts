/**
 * UI Hybrid Phase 1 — Token & Convention Guidelines
 *
 * Programmatic reference for the conventions that all migration phases must follow.
 * Import from here when building shared utilities or validating token usage.
 *
 * This file exports:
 *   1. BORDER_RADIUS — concrete border-radius scale
 *   2. CONTAINER_PRESETS — reusable sx presets for standard surfaces
 *   3. TOKEN_USAGE_PRIORITY — enforcement order for color tokens
 *   4. MIGRATION_TARGETS — the Phase 2+ file registry
 *
 * See also:
 *   - statusStyles.ts  — status Chip/badge styling
 *   - semanticColorUtils.ts  — semantic → MUI palette
 *   - muiTheme.ts  — global MUI theme
 */

import type { SxProps, Theme } from '@mui/material/styles';

import type { BorderRadiusScale, MigrationTarget } from '@/types/designTokens';

// ---------------------------------------------------------------------------
// 1. Border-radius scale (mirrors muiTheme.ts JSDoc)
// ---------------------------------------------------------------------------

export const BORDER_RADIUS: Readonly<BorderRadiusScale> = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// 2. Container style presets
// ---------------------------------------------------------------------------

/** Standard card surface: paper background + themed border + md radius. */
export const cardSurface: SxProps<Theme> = {
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: `${BORDER_RADIUS.md}px`,
};

/** Input container: subtle border that highlights on focus-within. */
export const inputContainer: SxProps<Theme> = {
  borderRadius: `${BORDER_RADIUS.sm}px`,
};

/** Dialog surface follows MuiDialog global overrides — no extra preset needed. */

// ---------------------------------------------------------------------------
// 3. Token usage priority (documentation constant)
// ---------------------------------------------------------------------------

/**
 * Ordered list used in PR review checklists and lint-rule rationale.
 * Higher priority entries should be preferred over lower ones.
 */
export const TOKEN_USAGE_PRIORITY = [
  'Semantic utilities (getStatusChipSx, mapSemanticToThemeColor)',
  'MUI theme palette via useTheme()',
  'CSS custom properties from tokens.css',
  'NEVER hardcoded hex colors',
] as const;

// ---------------------------------------------------------------------------
// 4. Phase 2+ migration target registry
// ---------------------------------------------------------------------------

/**
 * Components scheduled for migration in Phases 2-7.
 * Phase 1 locks this list; phases execute against it.
 */
export const MIGRATION_TARGETS: readonly MigrationTarget[] = [
  // Phase 2 — DataTable migrations
  {
    component: 'AdminShipManager',
    pattern: 'DataTable',
    phase: 2,
    file: 'components/admin/AdminShipManager.tsx',
  },
  {
    component: 'DirectoriesPage',
    pattern: 'DataTable',
    phase: 2,
    file: 'pages/DirectoriesPage.tsx',
  },
  { component: 'InboxPage', pattern: 'DataTable', phase: 2, file: 'pages/InboxPage.tsx' },
  {
    component: 'FederationManagePage',
    pattern: 'DataTable',
    phase: 2,
    file: 'pages/FederationManagePage.tsx',
  },
  {
    component: 'DiscordSettings',
    pattern: 'DataTable',
    phase: 2,
    file: 'pages/DiscordSettings.tsx',
  },

  // Phase 3 — FormField migrations
  {
    component: 'FederationManagePage',
    pattern: 'FormField',
    phase: 3,
    file: 'pages/FederationManagePage.tsx',
  },
  {
    component: 'DiscordSettings',
    pattern: 'FormField',
    phase: 3,
    file: 'pages/DiscordSettings.tsx',
  },
  {
    component: 'RecurrenceSection',
    pattern: 'FormField',
    phase: 3,
    file: 'components/RecurrenceSection.tsx',
  },
  {
    component: 'CreateMissionDialog',
    pattern: 'FormField',
    phase: 3,
    file: 'pages/CreateMissionDialog.tsx',
  },
  {
    component: 'CreateActivityTemplateDialog',
    pattern: 'FormField',
    phase: 3,
    file: 'pages/CreateActivityTemplateDialog.tsx',
  },
  {
    component: 'ApplyActivityTemplateDialog',
    pattern: 'FormField',
    phase: 3,
    file: 'pages/ApplyActivityTemplateDialog.tsx',
  },
] as const;
