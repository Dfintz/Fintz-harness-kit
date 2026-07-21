/**
 * Core Feature Definitions
 *
 * Minimal canonical feature definitions shared across landing pages.
 * Layout-specific content (imageUrl, useCases, benefits) lives in page components.
 *
 * CONSTRAINT: Feature content is always static; dynamic content is out of scope.
 */

export interface CoreFeatureDefinition {
  id: string;
  title: string;
  description: string; // Short description, 40-60 chars for grid cards
  icon: string; // Icon identifier (MUI icon name, e.g., 'RocketLaunch')
  color?: string; // Semantic color token (e.g., 'cyan')
  destination: {
    kind: 'public' | 'login';
    path?: string;
    redirectTo?: string;
  };
}

/**
 * Core feature definitions for SC Fleet Manager.
 * These are shared across all landing pages and marketing surfaces.
 */
export const coreFeatureDefinitions: CoreFeatureDefinition[] = [
  {
    id: 'fleet-management',
    title: 'Fleet Management',
    description:
      'Track every ship in your organization. Import from RSI, manage loadouts, assign crews, analyze composition.',
    icon: 'RocketLaunch',
    color: 'cyan',
    destination: { kind: 'public', path: '/star-citizen-fleet-management' },
  },
  {
    id: 'org-management',
    title: 'Org Management',
    description:
      'Multi-tenant architecture with roles, permissions, hierarchy, audit, and real-time collaboration.',
    icon: 'Groups',
    color: 'secondary',
    destination: { kind: 'public', path: '/star-citizen-org-management' },
  },
  {
    id: 'operations',
    title: 'Operations',
    description:
      'Plan operations with tactical briefings, ready checks, chain of command, and formation planning.',
    icon: 'GpsFixed',
    color: 'error',
    destination: { kind: 'public', path: '/star-citizen-org-management' },
  },
  {
    id: 'trade-logistics',
    title: 'Trade & Logistics',
    description:
      'Plan trade routes with live commodity pricing from UEX Corp, manage alerts, track cargo, optimize profit.',
    icon: 'LocalShipping',
    color: 'warning',
    destination: { kind: 'public', path: '/star-citizen-trade-logistics-tools' },
  },
  {
    id: 'discord-integration',
    title: 'Discord Integration',
    description:
      '32 slash commands across 8 domains. Event RSVP, voice channels, LFG, moderation auto-sync, full org management.',
    icon: 'Discord',
    color: 'discordBlue',
    destination: { kind: 'public', path: '/star-citizen-discord-integration-tools' },
  },
  {
    id: 'security-privacy',
    title: 'Privacy & Zero Trust',
    description:
      'End-to-end encryption, GDPR compliance, zero-trust security model, and audit logging throughout.',
    icon: 'Security',
    color: 'success',
    destination: { kind: 'public', path: '/star-citizen-fleet-management' },
  },
  {
    id: 'analytics-leaderboards',
    title: 'Analytics & Leaderboards',
    description:
      'Real-time dashboards, activity tracking, reputation scoring, and org-wide performance analytics.',
    icon: 'Leaderboard',
    color: 'info',
    destination: { kind: 'public', path: '/star-citizen-fleet-management' },
  },
  {
    id: 'calendar-events',
    title: 'Calendar & Events',
    description:
      'Org calendar with event RSVP, attendance tracking, calendar sync, and activity lifecycle management.',
    icon: 'CalendarMonth',
    color: 'purple',
    destination: { kind: 'public', path: '/star-citizen-fleet-management' },
  },
];
