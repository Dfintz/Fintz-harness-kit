/**
 * Navigation Types
 * Type definitions for the 5-hub navigation system
 */

import React from 'react';

import type { OrgRoleName } from '@/utils/roleUtils';

/**
 * Hub identifier for the 5-hub navigation system
 */
export type HubId = 'dashboard' | 'ops' | 'organization' | 'alliance' | 'community';

/**
 * Navigation item in a hub's sidebar
 */
export interface NavItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Route path */
  path: string;
  /** Icon component from Spectrum */
  icon: React.ComponentType;
  /** Whether this item requires an organization */
  requiresOrg?: boolean;
  /** Whether this item is only visible to admin users */
  adminOnly?: boolean;
  /** Whether this item requires a verified RSI profile */
  requiresRsiVerified?: boolean;
  /** Whether this item requires verified org owner status */
  requiresOrgOwner?: boolean;
  /** Minimum organization role required (e.g. 'officer' means officer+ can access) */
  minRole?: OrgRoleName;
  /** Tooltip shown when the item is disabled */
  disabledTooltip?: string;
  /** Feature flag to gate this item */
  featureFlag?: string;
  /** Badge count (e.g., notifications) */
  badge?: number;
}

/**
 * Section within a hub's sidebar
 */
export interface NavSection {
  /** Section title */
  title: string;
  /** Items in this section */
  items: NavItem[];
}

/**
 * Hub configuration
 */
export interface Hub {
  /** Hub identifier */
  id: HubId;
  /** Display label */
  label: string;
  /** Icon component from Spectrum */
  icon: React.ComponentType;
  /** Route path prefix */
  path: string;
  /** Sections in this hub's sidebar */
  sections?: NavSection[];
  /** Simple items without sections */
  items?: NavItem[];
  /** Whether this hub requires an organization */
  requiresOrg?: boolean;
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Route path (optional, last item typically has no path) */
  path?: string;
}

/**
 * Command palette item
 */
export interface Command {
  /** Unique command identifier */
  id: string;
  /** Display label (what user searches for) */
  label: string;
  /** Description shown in command palette */
  description: string;
  /** Route path to navigate to */
  path?: string;
  /** Category for grouping */
  category: 'dashboard' | 'ops' | 'organization' | 'alliance' | 'community' | 'tools' | 'help';
  /** Hub this command belongs to (for icon/color) */
  hub?: HubId;
  /** Alternative keywords for fuzzy search */
  keywords?: string[];
  /** Whether this requires organization context */
  requiresOrg?: boolean;
  /** Whether this is only visible to admin users */
  adminOnly?: boolean;
  /** Minimum org role required (e.g. 'officer' means officer+ can access) */
  minRole?: OrgRoleName;
  /** Keyboard shortcut to trigger (e.g., 'ctrl+k', 'cmd+shift+p') */
  shortcut?: string;
  /** Action to execute (if not just navigation) */
  action?: () => void | Promise<void>;
  /** Icon name from Spectrum Icons */
  icon?: string;
  /** Order for sorting within category */
  order?: number;
}
