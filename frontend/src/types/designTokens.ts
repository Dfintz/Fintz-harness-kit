/**
 * UI Hybrid Phase 1 — Design Token Type Definitions
 *
 * Canonical TypeScript types for the design token system.
 * Ensures all migration phases share a single vocabulary for
 * semantic colors, container patterns, and status categories.
 *
 * These types deliberately mirror what is already implemented in:
 *   - statusStyles.ts  (StatusCategory, status → category map)
 *   - semanticColorUtils.ts  (semantic → MUI palette mapping)
 *   - muiTheme.ts  (palette, border-radius scale)
 *
 * Phase 2+ consumers import from here rather than re-defining types.
 */

// ---------------------------------------------------------------------------
// Semantic color vocabulary
// ---------------------------------------------------------------------------

/** Semantic status categories used by `getStatusChipSx` and related utilities. */
export type StatusCategory =
  | 'positive'
  | 'active'
  | 'neutral'
  | 'warning'
  | 'negative'
  | 'info'
  | 'muted';

/** Semantic color identifiers accepted by `mapSemanticToThemeColor`. */
export type SemanticColor = 'positive' | 'negative' | 'info' | 'warning' | 'yellow' | 'neutral';

/** Sharing / visibility levels accepted by `getSharingLevelColors`. */
export type SharingLevel =
  | 'private'
  | 'personal'
  | 'shared_users'
  | 'organization'
  | 'alliance'
  | 'public';

// ---------------------------------------------------------------------------
// Container & surface patterns
// ---------------------------------------------------------------------------

/** Standard surface roles used across migration phases. */
export type SurfaceRole =
  | 'page' // theme.palette.background.default
  | 'card' // theme.palette.background.paper + border
  | 'dialog' // elevated paper with translucent gradient
  | 'input' // text field / form container
  | 'overlay'; // modal backdrops, glass panels

/** Border-radius scale (maps to the muiTheme shape conventions). */
export interface BorderRadiusScale {
  /** 4px — chips, badges, tags */
  xs: number;
  /** 8px — buttons, inputs, small cards (theme.shape.borderRadius) */
  sm: number;
  /** 12px — standard cards, dialogs */
  md: number;
  /** 16px — large panels, drawers */
  lg: number;
  /** 9999px — pill shapes */
  full: number;
}

// ---------------------------------------------------------------------------
// Migration helpers
// ---------------------------------------------------------------------------

/** Describes which pattern family a migration target belongs to. */
export type MigrationPattern =
  | 'DataTable'
  | 'FormField'
  | 'StatusChip'
  | 'LoadingState'
  | 'EmptyState';

/** Tracks readiness of a component for the migration checklist. */
export interface MigrationTarget {
  component: string;
  pattern: MigrationPattern;
  phase: number;
  file: string;
}
