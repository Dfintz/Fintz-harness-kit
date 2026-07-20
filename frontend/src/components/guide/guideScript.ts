/**
 * Guide Mode — Demo Script
 *
 * Declarative definition of the presenter-driven product tour. Each step can
 * navigate to a route, spotlight a stable on-screen target (via a `data-guide`
 * attribute or other selector), and show talking points.
 *
 * Targets intentionally use stable, always-present anchors (the top navigation,
 * hub buttons, and the `#main-content` region) so the tour stays reliable during
 * a live demo even as page internals change. If a target can't be found within
 * the engine's timeout, the step gracefully falls back to a centered card.
 */

export type GuidePlacement = 'center' | 'top' | 'bottom' | 'left' | 'right';

export interface GuideStep {
  /** Stable identifier for the step. */
  id: string;
  /** Short label for the scene this step belongs to (shown in the progress bar). */
  scene: string;
  /** Heading shown in the guide card. */
  title: string;
  /** Short framing sentence. */
  body: string;
  /** Optional bullet talking points. */
  points?: string[];
  /** Route to navigate to before showing the step (may include a query string). */
  route?: string;
  /** CSS selector for the element to spotlight. Omit for a centered card. */
  target?: string;
  /** Where to place the card relative to the target. Defaults to 'bottom'. */
  placement?: GuidePlacement;
  /** Delay (ms) before resolving the target — useful after a route change. */
  delay?: number;
}

export interface GuideScript {
  id: string;
  title: string;
  steps: GuideStep[];
}

/**
 * Default live-demo script. Covers the four flagship flows:
 * Dashboard, Fleet, Operations, and Community & Trading.
 */
export const DEFAULT_GUIDE_SCRIPT: GuideScript = {
  id: 'live-demo',
  title: 'Product tour',
  steps: [
    {
      id: 'welcome',
      scene: 'Welcome',
      title: 'Welcome to Fringe Core',
      body: 'Your command center for managing Star Citizen organizations, fleets, and operations. This quick tour hits the highlights — use the arrow keys or the buttons to move through it.',
      placement: 'center',
    },
    {
      id: 'navigation',
      scene: 'Getting around',
      title: 'One place for everything',
      body: 'The top bar groups the whole app into a handful of hubs.',
      points: [
        'Jump between hubs from the top navigation.',
        'Press Ctrl/⌘ + K anywhere to open the command palette.',
        'Number keys 1–4 jump straight to the main hubs.',
      ],
      target: '[data-guide="topnav"]',
      placement: 'bottom',
    },
    {
      id: 'dashboard',
      scene: 'Dashboard',
      title: 'Your situational overview',
      body: 'The dashboard is the at-a-glance picture of your org.',
      points: [
        'Key metrics and KPIs up top.',
        'Quick actions for the things you do most.',
        'A live activity feed of what the org is doing right now.',
      ],
      route: '/dashboard',
      target: '#main-content',
      placement: 'center',
      delay: 150,
    },
    {
      id: 'fleet',
      scene: 'Fleet',
      title: 'Manage the whole fleet',
      body: 'Track every hull and how it is crewed.',
      points: [
        'Browse ships, squadrons, and fleet composition.',
        'Build and compare loadouts.',
        'See ownership, loans, and availability at a glance.',
      ],
      route: '/fleet',
      target: '#main-content',
      placement: 'center',
      delay: 150,
    },
    {
      id: 'operations',
      scene: 'Operations',
      title: 'Plan and run operations',
      body: 'The ops center is where activities come together.',
      points: [
        'Schedule activities and events on the calendar.',
        'Brief the crew with interactive briefings.',
        'Coordinate roles, slots, and attendance.',
      ],
      route: '/activities',
      target: '#main-content',
      placement: 'center',
      delay: 150,
    },
    {
      id: 'community',
      scene: 'Community',
      title: 'Grow the org',
      body: 'Recruiting, teams, and finding people to fly with.',
      points: [
        'Form teams and squadrons.',
        'Post and answer Looking-for-Group calls.',
        'Run missions and bounties together.',
      ],
      route: '/teams',
      target: '#main-content',
      placement: 'center',
      delay: 150,
    },
    {
      id: 'trading',
      scene: 'Trading',
      title: 'Trade and logistics',
      body: 'Turn cargo runs into profit and keep the org supplied.',
      points: [
        'Plan profitable trading routes.',
        'Track commodity prices and margins.',
        'Manage inventory and the org treasury.',
      ],
      route: '/trading',
      target: '#main-content',
      placement: 'center',
      delay: 150,
    },
    {
      id: 'finish',
      scene: 'Wrap up',
      title: "That's the tour",
      body: 'That is the whirlwind version. Everything you saw is one click away from the top navigation — and the command palette (Ctrl/⌘ + K) gets you anywhere instantly. You can relaunch this tour any time from the Guide button.',
      placement: 'center',
    },
  ],
};
