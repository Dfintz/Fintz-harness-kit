/**
 * Platform Changelog Content
 *
 * User-facing release notes for the Fringe Core platform.
 * Newest entries first. Keep in sync with actual releases.
 *
 * @module data/changelogContent
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
  changes: {
    category: 'added' | 'fixed' | 'improved' | 'removed';
    items: string[];
  }[];
}

export const changelogEntries: ChangelogEntry[] = [
  {
    version: '2026.07.145',
    date: '2026-07-15',
    title: 'Discord ticket and recruitment routing is now clearer and more reliable',
    highlights: [
      'Discord ticket and recruitment actions now route to their dedicated channels more consistently.',
      'Ticket navigation is now clearer with a dedicated Tickets page, and older Inbox ticket links are redirected automatically.',
      'No migration or manual data changes are required for existing organizations.',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed channel-routing edge cases for Discord ticket issue flows and recruitment applicant flows so channel actions are more predictable.',
          'Fixed inconsistent category fallback behavior for ticket channel creation by prioritizing the canonical ticket category setting.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Added a dedicated Tickets page in the web app so support queues are easier to find and manage.',
          'Legacy Inbox links that used the tickets tab now redirect to the dedicated Tickets page automatically.',
          'Updated FAQ and release content in plain language so admins and members can quickly understand the workflow changes.',
        ],
      },
    ],
  },
  {
    version: '2026.07.144',
    date: '2026-07-15',
    title: 'Voice settings save errors are now clearer and easier to act on',
    highlights: [
      'If you cannot save Organization Voice Server settings, the message now clearly explains who can make that change.',
      'Members now see a direct, role-based guidance message instead of a vague permissions error.',
      'No setup changes are required for organizations already using voice settings.',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed unclear save feedback for Organization Voice Server settings so the app now states that founders, owners, and admins can manage those settings.',
          'Added protection to keep this clearer message consistent when a member tries to save voice settings without the required role.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Updated release and Help Center wording so voice-settings access guidance is easier to understand in plain language.',
        ],
      },
    ],
  },
  {
    version: '2026.07.143',
    date: '2026-07-14',
    title: 'Mirrored event posts now stay in sync more reliably',
    highlights: [
      'Discord event updates now refresh the source post and mirrored copies more consistently after ship and crew changes.',
      'Ship selection in Discord now labels the ship owner more clearly when you join as crew.',
      'No new setup is required for existing mirrored-event workflows.',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed an issue where an event update could appear on one post but not the others for a short time after ship or crew changes.',
          'Improved update recovery so the bot can still refresh the right event post if the usual path is temporarily unavailable.',
        ],
      },
      {
        category: 'improved',
        items: [
          'The Discord crew ship picker now says Owner instead of Captain, so it is clearer who controls each ship before you join a crew slot.',
          'Help and release wording were updated so mirrored-event behavior is easier to understand in plain language.',
        ],
      },
    ],
  },
  {
    version: '2026.07.142',
    date: '2026-07-14',
    title: 'Discord settings forms are now more reliable and easier to follow',
    highlights: [
      'Discord settings forms now open and save more reliably in day-to-day use.',
      'Help Center guidance now clearly explains which StarComms option to pick for both admins and members.',
      'No new setup steps are required for existing organizations.',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed several Discord form paths so buttons and form actions behave more consistently.',
          'Reduced cases where the same settings screen could look different between panels.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Updated Voice Server Help Center wording so choosing StarComms Central vs Private is easier to understand.',
          'Aligned FAQ and changelog wording so both admins and members can find support steps faster.',
        ],
      },
    ],
  },
  {
    version: '2026.07.141',
    date: '2026-07-14',
    title: 'Activity and Discord updates are now more dependable',
    highlights: [
      'Activity-related Discord updates now behave more consistently in day-to-day use.',
      'Teams should see fewer interruptions while coordinating events and announcements.',
      'StarComms voice setup guidance now clearly separates the Central and Private paths.',
      'No workflow changes are required for most users.',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a behind-the-scenes issue that could interrupt activity-related Discord updates.',
          'Improved member matching during updates so activity notifications are more stable.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Updated release messaging so changelog and help content use clearer, plain-language explanations.',
          'Aligned update summaries across changelog and FAQ so users can quickly understand what changed.',
          'Added clearer voice setup guidance so teams can tell when to choose StarComms Central versus StarComms Private.',
        ],
      },
    ],
  },
  {
    version: '2026.07.140',
    date: '2026-07-14',
    title: 'Voice, permissions, and cross-org setup are now more reliable',
    highlights: [
      'Voice settings now open and save more reliably in organization and federation areas.',
      'Permission Simulator now uses easier pre-filled dropdown choices.',
      'Cross-organization lists now appear more consistently in Discord moderation and LFG setup.',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed an issue where opening voice settings could sign some users out unexpectedly.',
          'Fixed a federation voice-sharing save path that could sign users out in some cases.',
          'Fixed CAS activity heatmap coloring so different activity levels are easier to distinguish.',
          'Fixed a member access drawer error that could appear for some permission data shapes.',
          'Fixed cross-moderation suggested guilds so federated organizations and allied organizations now appear more reliably in setup.',
          'Fixed a matching issue where valid allied suggestions could be missed when the relationship was created by the other organization.',
          'Fixed a suggestion issue where the same status written with different letter styles could hide valid results.',
          'Fixed empty organization options in cross-organization LFG setup.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Permission Simulator now uses guided dropdowns so checking access is faster and easier.',
          'Treaty-linked organization names now show more clearly in related sharing lists.',
        ],
      },
    ],
  },
  {
    version: '2026.07.139',
    date: '2026-07-13',
    title: 'Organization and alliance links are now more stable',
    highlights: [
      'Organization profile links now keep working better after name changes.',
      'Alliance profile links now use cleaner shareable addresses when available.',
      'Help Center guidance was updated in plain language for everyday members.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          "Public organization links now prefer your organization's stable RSI SID route, so renamed orgs are less likely to break older shared links.",
          'Public alliance links now prefer the alliance slug route, so links are cleaner and easier to share than raw IDs.',
          'Help and release notes were refreshed with simple wording so members can quickly understand what changed and what to expect.',
        ],
      },
    ],
  },
  {
    version: '2026.07.138',
    date: '2026-07-13',
    title: 'Changelog and FAQ updates are now easier to read',
    highlights: [
      'Recent update notes now use simpler wording for everyday members.',
      'StarComms access labels are explained in clearer, practical terms.',
      'CAS Activity Pulse heatmap behavior is now documented in plain language.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Changelog wording was refreshed so you can scan updates faster and understand what changed without technical terms.',
          'FAQ guidance now explains StarComms access labels in plain language and points to where you can update settings.',
          'Help guidance now explains that the CAS heatmap can start with lighter color when activity is low, then becomes more colorful as more activity is recorded.',
        ],
      },
    ],
  },
  {
    version: '2026.07.137',
    date: '2026-07-13',
    title: 'StarComms access is easier to understand',
    highlights: [
      'StarComms access now shows clearer context about why a connection is available to you.',
      'Teams can now manage StarComms access roles more cleanly in Discord settings.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'StarComms setup messages now use clearer wording, so members can quickly tell whether access is owned, shared, public, or managed by an admin role.',
          'Role setup for StarComms access is now easier to manage separately from other Discord server-management responsibilities.',
        ],
      },
      {
        category: 'added',
        items: [
          'Help content now includes clearer guidance on what StarComms access labels mean and where to adjust access setup.',
        ],
      },
    ],
  },
  {
    version: '2026.07.136',
    date: '2026-07-13',
    title: 'New StarComms landing post and support guidance',
    highlights: [
      'The Discord integration landing page now includes a StarComms integration support post.',
      'It is now clearer where to start and where to go for help.',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Added a public landing post update for StarComms integration and support on the Discord integration tools page.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Support guidance now points users from the landing overview to the Help Center for setup and troubleshooting answers.',
        ],
      },
    ],
  },
  {
    version: '2026.07.135',
    date: '2026-07-13',
    title: 'Voice Servers view now uses one consistent source',
    highlights: [
      'The Voice Servers page now reads from one reliable access source.',
      'Server visibility and status updates now feel more consistent across refreshes.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Voice Servers now load from one consistent access path, so what you can see is easier to trust.',
          'Setup and visibility behavior is now more predictable across related communication screens.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed rare cases where older backup logic could make server visibility look inconsistent.',
        ],
      },
    ],
  },
  {
    version: '2026.07.134',
    date: '2026-07-13',
    title: 'Federation voice sharing setup is easier and clearer',
    highlights: [
      'You can now manage federation voice sharing from dedicated setup flows.',
      'Helpful sharing suggestions reduce manual setup work for admins.',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Added dedicated setup support for federation voice-sharing settings so admins can review and update sharing in one place.',
          'Added smart sharing suggestions to help you quickly add the right federations and organizations.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Voice-sharing setup and save behavior is now more consistent, with clearer outcomes after updates.',
        ],
      },
    ],
  },
  {
    version: '2026.07.132',
    date: '2026-07-13',
    title: 'More reliable behavior across everyday workflows',
    highlights: [
      'Core workflows now feel more consistent across pages and actions.',
      'Several state-sync edge cases were cleaned up for smoother day-to-day use.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'General reliability updates reduce situations where screens appear out of sync with your latest actions.',
          'Common workflow behavior is now more consistent as you move between related pages.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed multiple edge cases where action results could be delayed or unclear in the UI.',
        ],
      },
    ],
  },
  {
    version: '2026.07.133',
    date: '2026-07-13',
    title: 'Clearer release guidance and supporting documentation',
    highlights: [
      'Release notes and support guidance were refreshed for clarity.',
      'Review and follow-up documentation is now easier to navigate.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Release and support documentation was rewritten in clearer language to make recent updates easier to follow.',
          'Related guidance and review notes were organized to make follow-up work simpler.',
        ],
      },
    ],
  },
  {
    version: '2026.07.131',
    date: '2026-07-13',
    title: 'Easier invites and a smoother way to join organizations',
    highlights: [
      'Invitation and join pages now make next steps clearer.',
      'Organization and Discord-related settings now better reflect your current invite and join state.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Invitation and join flow wording is now simpler, so members can tell what to do next without guesswork.',
          'Organization settings pages now show clearer state around invite and join actions, especially when Discord setup is involved.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed cases where invitation state and organization settings could appear out of sync between pages.',
        ],
      },
    ],
  },
  {
    version: '2026.07.130',
    date: '2026-07-13',
    title: 'Clearer communication setup and easier activity sync visibility',
    highlights: [
      'Communication setup pages now make it easier to connect tools and confirm what is ready.',
      'Activity communication sync status is now easier to understand at a glance.',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'New communication setup and status panels help org teams see what is connected and what still needs action before going live.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Setup and review steps now use clearer wording and flow, so members can complete communication setup with less back-and-forth.',
          'Activity communication sync feedback now better explains current state after updates.',
        ],
      },
    ],
  },
  {
    version: '2026.07.121',
    date: '2026-07-03',
    title: 'Easier ways to find organizations, alliances, and opportunities',
    highlights: [
      'You can now open direct pages for Organizations, Alliances, and Opportunities from the public directory area.',
      'Help Center guidance now clearly explains where each page lives and what you can do there.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Finding community pages is now simpler: use Organizations when you want to browse groups, Alliances when you want to explore partnerships, and Opportunities when you want to see open roles and recruitment posts.',
          'The update notes and Help Center wording were rewritten in plain language, so it is easier to understand what changed without technical terms.',
        ],
      },
    ],
  },
  {
    version: '2026.07.120',
    date: '2026-07-07',
    title: 'Fairer role changes and more reliable fleet crew estimates',
    highlights: [
      "You can now only change a member's role if that role is below yours — the same rule applies everywhere, including Discord.",
      'Crew size suggestions for your fleet activities are more dependable across all ship types.',
    ],
    changes: [
      {
        category: 'added',
        items: [
          "Role assignment is now consistently enforced: you can only promote or demote members to roles that sit below your own. An Admin can manage Officers and Members; a Fleet Commander cannot make someone an Admin; a plain Member cannot change any other member's role. Any attempt that would break this rule is blocked with a clear message instead of being silently ignored.",
        ],
      },
      {
        category: 'improved',
        items: [
          'Fleet crew size estimates are now verified to stay accurate for every ship type — fighters, transports, capital ships, and snubs — across all supported crew planning modes. The numbers you see have not changed; this ensures they stay correct as more ships are added to the catalogue.',
        ],
      },
    ],
  },
  {
    version: '2026.07.110',
    date: '2026-07-01',
    title: 'Smarter notifications and a more readable light theme',
    highlights: [
      'Clicking a notification now takes you straight to what it’s about, instead of always opening the Inbox.',
      'Light theme is easier to read, and the theme switch now shows which mode is active.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'When you click a notification in the bell, it now opens the exact thing it refers to — the specific message, activity, or item — and only falls back to your Inbox when there is nothing specific to open.',
          'Light theme is much easier to read: the side navigation text is now clearly visible instead of dark-on-dark.',
          'The theme switch now shows a label (System, Dark, or Light) so you can tell the two dark options apart at a glance.',
          'For admins: a clearer system health view (cache and integration status) and a ship roster in the admin panel.',
        ],
      },
    ],
  },
  {
    version: '2026.07.100',
    date: '2026-07-01',
    title: 'One place to handle new members, and a clearer picture of how people join',
    highlights: [
      'A new Membership Inbox gathers every incoming member — applications, invitations, and recruitment applicants — in one list.',
      'A new “How members joined” breakdown on your Members tab shows where your members came from.',
      'Any org admin can now review recruitment applicants, and accepting one adds them to your roster automatically.',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'The new Membership Inbox brings together everyone trying to join your organization — join applications, invitations you have sent, and recruitment-post applicants — in a single, newest-first list. Your Dashboard “Pending Approvals” now takes you straight there, and each item has a Review button that opens the right place to act.',
          'A new “How members joined” panel at the top of your Members tab breaks down your roster by how each person arrived (application, invitation, founder, recruitment, or added manually), with simple percentage bars.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Reviewing recruitment applicants is no longer limited to whoever created the post — any leader with recruitment-approval permission can now review them.',
          'The role permissions grid is clearer: each permission now has a plain-language tooltip, and actions that do not apply to a given area are greyed out so you can see what you are actually granting.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Accepting a recruitment applicant now automatically adds them to your organization roster and member stats.',
          'Admins added to an organization no longer show a stray ID where their job title should be.',
          'Opening the admin login page no longer bounces you to the member login with a “session expired” message.',
          'The Discord bot’s “open opportunities” count now matches what actually appears on the public Opportunities page.',
          'Your dashboard’s CAS activity panels now show your data instead of a “no data yet” message when results already exist.',
        ],
      },
    ],
  },
  {
    version: '2026.06.510',
    date: '2026-06-30',
    title: 'Security and reliability improvements',
    highlights: [
      'Under-the-hood security and stability updates across the platform.',
      'AI-generated tactical briefings are temporarily turned off while we strengthen their safety — manual briefings still work.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Behind-the-scenes security and reliability updates: the latest dependency security patches, tighter handling of the “post a briefing to Discord” link, and steadier real-time updates so live panels stay in sync.',
          'Clearer Looking-for-Group wording and small localization touch-ups.',
        ],
      },
      {
        category: 'removed',
        items: [
          'AI-generated tactical briefings are temporarily turned off while we strengthen their safety. You can still create and edit briefings yourself on the tactical canvas, and the Discord briefing tools are unaffected.',
        ],
      },
    ],
  },
  {
    version: '2026.06.500',
    date: '2026-06-28',
    title:
      'Missions join Activities, a richer briefings canvas, clearer statuses, and tidier menus',
    highlights: [
      'Tactical briefings get a real editor: select, move, and delete map elements, present full-screen, export a PNG, and post straight to Discord.',
      'Find your gameplay, bounty, and attendance numbers together on one Stats page, and Missions now live alongside Activities.',
      'New plain-language explainers show what each bounty, ticket, application, and fleet-health status means.',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'The tactical briefings canvas is now fully editable: click to select, drag to move, and delete map elements; flip through pages in a full-screen present mode; export the board as a PNG; and post a briefing to Discord with one click. You can also save an interdiction plan straight into a briefing, complete with labeled map markers and a system-map background.',
          'A single Stats page brings together your Gameplay, Bounty Hunter, and Attendance numbers; your old bookmarks still work.',
          'Status explainers across the app: bounties, support tickets, and applications now show a step-by-step lifecycle, and fleet-health, CAS, and loot splits show a plain-language breakdown so you can see exactly how a number was reached. Rejected applications now show the reason.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Missions are now part of Activities, so everything you plan and run lives in one place — existing mission links still open the right page.',
          'Tidier menus: Intel is now a single tabbed page, Recruitment moved under Organization, and Discord settings are split into focused pages (Setup, Communication, Voice, Roles, Moderation). You can collapse the sidebar to an icon rail, and Help sits neatly at the bottom.',
          'Quick command palette (Ctrl/Cmd+K) verbs like Create Activity, Switch Organization, and Toggle Theme.',
          'Discord messages from the bot now share a consistent, branded look across verification, recruitment, moderation, announcements, and more.',
        ],
      },
    ],
  },
  {
    version: '2026.06.420',
    date: '2026-06-17',
    title: 'A fresh new look, light mode, simpler menus, and clearer member roles',
    highlights: [
      'Pick your look: dark, light, or match-your-device, plus a Comfortable or Compact layout — all in Settings → Appearance.',
      'Your notifications bell moved to the top bar with an unread badge, and the menus were simplified so related tools sit together.',
      'A new Member Access panel shows exactly what each member can do and where each permission comes from.',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Light mode is here. Open Settings → Appearance to choose Dark, Light, or System (System follows your device’s light/dark setting automatically). You can also pick a Comfortable or Compact layout density to fit more on screen — your choice is saved to your account and applies everywhere, including data-heavy tables.',
          'A new Member Access panel (Settings → Members & Roles) lets leaders see everything a member is allowed to do in one searchable place, shows where each permission comes from (their role or a personal override), and lets you preview changes before applying them.',
          'Ship, organization-ship, and trading list pages now share one tidy search-and-filter bar, with a reset button and a badge showing how many filters are active.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Your notifications bell now lives in the top bar with an unread badge, so alerts are one click away from any page. The old Notifications page now opens your Inbox.',
          'Menus are simpler. The separate Alliance section is gone — Relations and Alliances now live under Organization → Diplomacy. Operations is grouped into Play, Planning, Fleet, and Economy so related tools sit together. On phones, the bottom bar now shows four hubs: Dashboard, Ops, Organization, and Community.',
          'A cleaner, more readable look across the app: refreshed colors, a new typeface, smoother transitions, and friendlier “nothing here yet” screens that point you to the next step.',
          'Dates and times are easier to read — you’ll see friendly “2 hours ago” style timestamps, and event times now show in the correct time zone.',
          'Activity history views (such as fleet and encryption logs) now share one consistent, easy-to-scan format.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Discord bot reliability: sign-in and link actions are more dependable, and applying to a recruitment post that has since closed now shows a clear message instead of an error.',
        ],
      },
    ],
  },
  {
    version: '2026.06.400',
    date: '2026-06-13',
    title: 'Mobile-friendly redesign: stacked cards, live previews, and tidier navigation',
    highlights: [
      'Many more pages stack into easy-to-read cards on phones instead of wide, side-scrolling tables.',
      'Settings pages now show a live preview so you can see the effect of your choices before saving.',
      'Breadcrumbs are back on mobile, and the desktop top bar stays tidy on smaller screens.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'On phones, many list pages now switch to stacked cards instead of wide tables, so you no longer have to scroll sideways. This now covers Organization Ships (org fleet, member-shared ships, and ships available for loan — with loan and return actions kept on the cards), Federation member lists (active members and pending invitations), Intel Officer management (officers and audit logs), and your Personal Hangar ship list. Larger screens keep the familiar table layout.',
          'Settings pages now include a Live Preview that explains, in plain language, the effect of your current choices before you save. Notification Settings shows which channels are on, how many categories are enabled, your digest frequency, and whether everything is muted. Privacy Settings shows which data uses are active. Account Settings shows how your profile will appear to other members from your display name and RSI handle.',
          'The Activity Detail page now leads with a single, clear primary action on phones (Join, Switch Ship, or Edit) and tucks the rest into a "More actions" menu, so the most important action is easy to find and tap.',
          'Breadcrumbs now appear on mobile as a compact, swipeable strip, giving you a clear sense of where you are and a quick way to step back up a level. On desktop, the top navigation bar now tidies itself on smaller screens so the organization switcher and your profile menu always stay in reach.',
        ],
      },
    ],
  },
  {
    version: '2026.06.396',
    date: '2026-06-12',
    title: 'Release 2.2.520-2.2.529: easier mobile pages + new getting-started checklist',
    highlights: [
      'Many pages now read better on phones by using stacked cards instead of wide tables.',
      'Dashboard now includes a simple Getting Started Checklist so new members can finish setup faster.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Mobile readability improvements were rolled out across squadron overview, squadron member details, admin ship import previews, fleet composition, encryption key management, encryption claims/audit history, fleet crew assignments, and org watchlist pages. On small screens these areas now use stacked cards to avoid side-scrolling, while larger screens keep the existing table layouts.',
          'Dashboard Command Hub now shows a Getting Started Checklist with the most important first steps (link RSI, add your first ship, and join an organization). The checklist updates as you complete steps and can be dismissed per account.',
        ],
      },
    ],
  },
  {
    version: '2026.06.386',
    date: '2026-06-12',
    title: 'Release 2.2.519: ship loans are easier to scan on mobile',
    highlights: [
      'Ship loans now switch to stacked cards on small screens, so borrowers, lenders, and return dates are readable without horizontal scrolling.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'On phones and other small screens, the ship loans view now uses cards instead of a wide table. Each card highlights the ship, status, borrower, lender, start date, expected return, and return state while keeping the existing desktop table unchanged.',
        ],
      },
    ],
  },
  {
    version: '2026.06.385',
    date: '2026-06-12',
    title: 'Release 2.2.518: admin Discord guild settings now show a live preview',
    highlights: [
      'Platform admins now get the same live event behavior summary inside admin Discord guild settings, reducing guesswork before saving reminder, RSVP, and cleanup settings.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'The admin Discord guild settings page now shows a live preview for event settings. As admins change RSVP, reminders, mirror limits, scheduled-event options, and cleanup timing, the preview immediately summarizes how new event posts will behave. When Discord metadata is not loaded, the preview still uses the entered IDs so the summary stays actionable without extra network calls.',
        ],
      },
    ],
  },
  {
    version: '2026.06.384',
    date: '2026-06-12',
    title: 'Release 2.2.517: federation event settings now show a live preview',
    highlights: [
      'Federation guild event settings now include the same live behavior preview as the main Discord event settings page, making central-server configuration easier to reason about before saving.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'When configuring federation guild event settings, you now see a live summary of how event announcements and automation will behave with the current unsaved settings. This extends the event-settings preview pattern to the federation workflow, so admins can understand reminders, mirrors, announcement destination, voice category, and cleanup behavior at a glance.',
        ],
      },
    ],
  },
  {
    version: '2026.06.383',
    date: '2026-06-12',
    title: 'Release 2.2.516: Discord event settings now show a live preview',
    highlights: [
      'The Discord event settings page now shows a live summary of how new event posts will behave, making it easier to understand announcement, RSVP, reminder, and cleanup settings before saving.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'When configuring Discord event settings, you now see a live preview that summarizes where event posts go, which roles get mentioned, whether RSVP buttons and scheduled events are enabled, whether threads and voice channels are created, how reminders behave, and when cleanup happens. This reduces settings fatigue by showing the combined effect of the current form state in one place.',
        ],
      },
    ],
  },
  {
    version: '2026.06.382',
    date: '2026-06-12',
    title: 'Release 2.2.515: maintenance records are easier to use on mobile',
    highlights: [
      'Maintenance records now switch from a cramped table to stacked cards on small screens, making the page much easier to scan and use on phones.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'On mobile, maintenance records now show as cards instead of a wide multi-column table. Key details like ship, status, type, dates, cost, and performer are easier to read without horizontal scrolling, while larger screens keep the existing table layout.',
        ],
      },
    ],
  },
  {
    version: '2026.06.381',
    date: '2026-06-12',
    title: 'Release 2.2.514: more reliable voice auto-create cleanup',
    highlights: [
      'Join-to-create voice channels now clean up more reliably if a user disconnects during channel creation, reducing the chance of stale temporary voice state lingering behind the scenes.',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'If a temporary voice channel is created but Discord cannot move the user into it because they disconnected at just the wrong moment, the rollback now fully clears the temporary channel tracking record as well as the channel itself. This keeps voice auto-create state in sync and avoids stale cleanup/reconcile leftovers.',
        ],
      },
    ],
  },
  {
    version: '2026.06.380',
    date: '2026-06-12',
    title: 'Release 2.2.513: mirror sync visibility + manual resync',
    highlights: [
      'Event organizers can now manually trigger mirror refreshes from Discord and immediately see mirror-sync coverage details (linked mirrors, syncable mirrors, and posted mirror messages).',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Event cards now include a Resync control in the organizer actions. When used, it shows mirror-sync visibility details and sends a manual refresh signal so source and mirrored event posts can catch up if updates looked stale.',
        ],
      },
    ],
  },
  {
    version: '2026.06.379',
    date: '2026-06-12',
    title: 'Release 2.2.512: event drafts now resume in Discord wizard',
    highlights: [
      'If you reopen the Discord event creation wizard while you already have an active draft, it now resumes your draft instead of wiping your progress.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Running /events create again during an active draft now brings you back to that draft with your previously entered fields (like title and date/time) still present. This prevents accidental loss of in-progress event setup and makes it easier to continue after interruptions.',
        ],
      },
    ],
  },
  {
    version: '2026.06.378',
    date: '2026-06-12',
    title: 'Release 2.2.511: clearer event cards in Discord',
    highlights: [
      'Discord event cards now show a truthful "last updated" time and stay readable even when they contain a lot of detail, instead of risking oversized embed sections.',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          "Event cards in Discord now show when they were last updated, so it is easier to tell whether a refreshed event, mirror update, or edit is recent. Long event sections (like role requirements, ship assignments, logistics, and participant lists) are also safely trimmed to Discord's field-size limits instead of risking a failed render when an event gets very detailed.",
        ],
      },
    ],
  },
  {
    version: '2026.06.377',
    date: '2026-06-12',
    title: 'Release 2.2.509: friendlier "try again" messages in Discord',
    highlights: [
      'When a Discord command can\u2019t complete because the service is momentarily busy or rate-limited, the bot now tells you to try again in a moment instead of showing a generic "something went wrong".',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Discord commands, buttons, and forms now show a clearer message when a failure is temporary: if the platform is briefly busy or a connected service is slow, you\u2019ll see "the service is a bit busy right now \u2014 please try that again in a moment", and if an action is being rate-limited you\u2019ll be asked to wait a moment and retry. Genuine errors still show the normal message, and no internal details are ever exposed.',
        ],
      },
    ],
  },
  {
    version: '2026.06.376',
    date: '2026-06-12',
    title: 'Release 2.2.486–2.2.506: clearer error messages across the app',
    highlights: [
      'A broad behind-the-scenes quality pass so errors are now more specific and easier to understand, instead of many cases showing the same generic error screen. Daily workflows stay the same.',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Many parts of the app now explain what went wrong more clearly, such as when something is missing, when you do not have access, or when information needs to be corrected before trying again. This update was applied across major areas including intel, incident response, polls, webhooks, support tickets, announcements, teams, skills, applications, fleets, event waitlists, password reset, reminders, and the wiki.',
          'Fixed a shared error-message gap so fleets, events, activities, sign-in flows, and summary views are less likely to show a vague generic error when a clearer reason is available.',
        ],
      },
    ],
  },
  {
    version: '2026.06.355',
    date: '2026-06-11',
    title: 'Release 2.2.444–2.2.485: bot & UX polish, consistency, and cleanup',
    highlights: [
      'This release adds a top-bar organization switcher, friendlier "join an organization" prompts, and multiple Discord bot quality upgrades. It also includes privacy and reliability improvements that help everything feel more consistent.',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Organization switcher in the top bar — see your active organization and switch between the ones you belong to from any page, with a "Browse Organizations" shortcut. Switching updates the whole app instantly.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord bot — destructive actions now confirm first: closing a poll, closing a Looking-For-Group post, and removing the /rsistatus live panel each show an "are you sure?" step, matching the rest of the bot.',
          'Discord bot — the /poll panel now lets you pick a poll from a dropdown (by title) when posting, viewing results, or closing, instead of copying and pasting poll IDs.',
          'Discord bot — Previous / Next paging added to the active-bounty list, the active-poll list, and your bounty "My Claims" list, so you can browse every entry instead of only the first 10.',
          'Discord bot — slower commands (stats, discovery, analytics, and more) now acknowledge you instantly with a "working on it" indicator, so you should see far fewer "This interaction failed" errors.',
          'Discord bot — large organization role syncs are now paced automatically, so bigger updates finish more reliably without interrupting other bot activity (members whose roles are already correct are skipped).',
          'Organization-only pages no longer bounce you to the dashboard or leave you at a dead end when you have no active organization — they now show a clear "Join an organization to continue" prompt with a "Browse Organizations" button (members, hierarchy, settings, Intel Officers, and Cross-System Analytics).',
          'Friendlier empty states — the Announcements and Activity Templates pages now offer a useful action (create, or clear filters) when the list is empty, instead of a plain "none found" notice.',
          'Privacy & security — added another safety check so sensitive account details are automatically removed from internal logs.',
          'Internal consistency — made list and validation behavior more consistent across admin, organization, and activity areas. There is no workflow change for members.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Comments, documents, backups, and missions now show clearer error reasons instead of falling back to a generic server error. This was the first step of the broader error-message clarity work completed the next day.',
        ],
      },
      {
        category: 'removed',
        items: [
          'Removed unused old code and duplicate helpers to keep the platform easier to maintain, with no visible workflow changes for members.',
        ],
      },
    ],
  },
  {
    version: '2026.06.316',
    date: '2026-06-10',
    title: 'Release 2.2.443: giveaway lists in Discord can now be paged',
    highlights: [
      'The active-giveaway list in the Discord bot now has Previous / Next buttons, like the tickets list',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Extended the new Previous / Next paging to the Discord active-giveaway list (/giveaway → List Giveaways), so you can browse every giveaway instead of only the first 10. More lists will follow.',
        ],
      },
    ],
  },
  {
    version: '2026.06.315',
    date: '2026-06-10',
    title: 'Release 2.2.442: page through long lists in the Discord bot',
    highlights: [
      'Long lists in the Discord bot can now be paged with Previous / Next buttons instead of cutting off after the first 10 items',
      'First available on your open tickets list — more lists will follow',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Added Previous / Next buttons to long lists in the Discord bot so you can browse every item instead of only seeing the first 10. Your open-ticket list (/ticket → Tickets) is the first to use it; the page indicator shows which page you are on.',
        ],
      },
    ],
  },
  {
    version: '2026.06.314',
    date: '2026-06-10',
    title: 'Release 2.2.441: a consistent confirmation step for closing support tickets',
    highlights: [
      'When two-step ticket closing is enabled, the "close ticket" confirmation now matches the same clear "are you sure?" style used elsewhere in the bot',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Ticket closing now uses the same consistent confirmation style as other bot actions (when your server has two-step ticket close enabled). The confirm step behaves exactly as before — closing a ticket still asks you to confirm first, and cancelling makes no changes — it just looks and reads the same as the rest of the bot now.',
        ],
      },
    ],
  },
  {
    version: '2026.06.313',
    date: '2026-06-10',
    title: 'Release 2.2.440: a confirmation step before denying a recruitment application',
    highlights: [
      'Denying a recruitment application from Discord now asks you to confirm first, so a single mis-click can no longer reject an applicant',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Clicking "Deny" on a Discord recruitment application now shows a clear confirm step ("Deny Application" / "Keep Pending") instead of denying right away. Nothing is denied until you confirm, and choosing "Keep Pending" makes no changes. This continues the consistent "are you sure?" rollout for bot actions that can\'t be undone.',
        ],
      },
    ],
  },
  {
    version: '2026.06.312',
    date: '2026-06-10',
    title: 'Release 2.2.439: cancelled Discord events now update correctly',
    highlights: [
      'After you confirm cancelling an event from Discord, the event message now updates to show it is cancelled',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed the new confirm-before-cancel step so that, once you confirm, the original Discord event message updates to show the event as cancelled and removes its action buttons. Previously the message could still look active even though the event was cancelled.',
        ],
      },
    ],
  },
  {
    version: '2026.06.311',
    date: '2026-06-10',
    title: 'Release 2.2.438: a confirmation step before cancelling a Discord event',
    highlights: [
      'Cancelling an event from Discord now asks you to confirm first, so a single mis-click can no longer cancel an event',
      'A consistent "are you sure?" step is being rolled out across the bot for actions that can\'t be undone',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Clicking "Cancel Event" on a Discord event now shows a clear confirm step ("Cancel Event" / "Keep Event") instead of cancelling right away. Nothing is cancelled until you confirm, and choosing "Keep Event" makes no changes.',
          'Introduced a single, consistent confirmation style for destructive bot actions so future "are you sure?" prompts look and behave the same everywhere.',
          'Added a Help Center answer about the new confirm-before-cancel step.',
        ],
      },
    ],
  },
  {
    version: '2026.06.310',
    date: '2026-06-10',
    title: 'Release 2.2.437: more consistent Discord bot messages',
    highlights: [
      'When the Discord bot hits a snag or asks you to slow down, the message now reads the same whether you used a slash command, a button, a form, or a dropdown',
      'Bot error messages no longer show technical details — just a clear, friendly note',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Unified how the Discord bot handles every kind of action (slash commands, buttons, forms, and dropdown menus) so cooldown ("please wait a moment") and error messages are worded consistently across all of them.',
          'Tidied up bot error replies so they no longer include internal technical detail, while the full information is still recorded safely on our side for troubleshooting.',
          'Added a Help Center answer explaining the bot\u2019s "please wait" and error messages.',
        ],
      },
    ],
  },
  {
    version: '2026.06.309',
    date: '2026-06-10',
    title: 'Release 2.2.436: behind-the-scenes reliability tidy-up',
    highlights: [
      'Internal cleanup that makes activity join, leave, and application-accept handling easier to maintain',
      'No change to how anything looks or works for you — same features, same behavior',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Streamlined the shared code that keeps activity participant counts correct when people join, leave, or are accepted at the same time, so this protection is consistent and easier to maintain going forward. This is an internal change with no visible difference in the app.',
        ],
      },
    ],
  },
  {
    version: '2026.06.308',
    date: '2026-06-10',
    title: 'Release 2.2.435: more reliable activity joins, polls, and background tasks',
    highlights: [
      'Activities with a participant limit can no longer be overbooked, even when many people join at once',
      'Polls with an end time now close on their own, exactly once, and on schedule',
      'Behind-the-scenes maintenance (like account/organization cleanup) now runs more safely and predictably',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a rare case where several people joining a limited-capacity activity at the same moment could push it past its maximum number of participants.',
          'Fixed the participant count so it stays accurate when people join, leave, or are accepted into an activity at the same time.',
          'Fixed timed polls so they reliably close once their end time passes, without ever closing twice or sending duplicate "poll closed" updates.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved scheduled background tasks (such as organization deletion, account cleanup, export cleanup, and privacy data cleanup) so they run once even across multiple servers and recover cleanly if interrupted.',
          'Improved large privacy cleanup runs to process records in steady batches, keeping the service responsive.',
          'Added clearer Help Center answers about how activity capacity and automatic poll closing work.',
        ],
      },
    ],
  },
  {
    version: '2026.06.307',
    date: '2026-06-10',
    title: 'Release 2.2.434: switching your active organization is now more reliable',
    highlights: [
      'Your Organizations list now shows the correct organization as "active" every time',
      'Switching your active organization is faster and more dependable',
      'If an organization you left is still set as active, the app now clears it for you automatically',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed an issue where the wrong organization (or none) could appear as your active one in the organization switcher.',
          'Fixed cases where leaving or losing access to an organization could leave it stuck as your active one and block some pages until you picked another.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved the organization switcher so changing, joining, and leaving organizations updates the list right away.',
          'Made saving your active organization more dependable, with clearer in-app feedback if something goes wrong.',
          'Added clearer Help Center guidance on how the active organization works and how to switch it.',
        ],
      },
    ],
  },
  {
    version: '2026.06.306',
    date: '2026-06-09',
    title: 'Release 2.2.433: Trading now opens your active org UEX store page automatically',
    highlights: [
      'The Open UEX Store button now follows your currently active organization',
      "If your active org has an RSI SID, the link opens that org's UEX marketplace page automatically",
      'If no RSI SID is available yet, the app still uses the configured fallback store link',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a Trading behavior where Open UEX Store could always open one fixed org page instead of the org you are currently viewing.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved org-aware link behavior so Trading follows your active organization context more reliably.',
          'Added clearer Help Center wording to explain why the UEX store link can differ between organizations.',
        ],
      },
    ],
  },
  {
    version: '2026.06.305',
    date: '2026-06-09',
    title: 'Release 2.2.432: federation voice sharing now saves more reliably',
    highlights: [
      'Organization voice sharing now saves correctly when you whitelist organizations from federation workflows',
      'Shared federation voice servers now appear more reliably after saving sharing rules',
      'If voice settings fail to save, the page now shows a clearer error message',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a save issue where some federation-sharing voice settings could fail when organization IDs were included in the whitelist.',
          'Fixed a visibility issue where users could miss a shared federation voice server after saving access rules.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved voice settings feedback so save failures are shown clearly instead of failing silently.',
          'Added clearer Help Center guidance for federation voice sharing IDs and shared-server visibility checks.',
        ],
      },
    ],
  },
  {
    version: '2026.06.304',
    date: '2026-06-09',
    title: 'Release 2.2.431: trading route suggestions now connect more reliably',
    highlights: [
      'Trade route suggestions now load more reliably when the external market-data service expects a bearer token format',
      'Route creation now handles route-stop and tag inputs more consistently',
      'Trade dispute notes now handle evidence links more safely when added from forms',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a trading-data authentication mismatch that could cause route suggestions to fail in some environments.',
          'Fixed edge cases where evidence-link input could be interpreted inconsistently in trade dispute summaries.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved route creation input handling so route stops and tags are saved in a cleaner, more predictable format.',
          'Improved environment setup guidance for trading data integration to make deployments easier to verify.',
        ],
      },
    ],
  },
  {
    version: '2026.06.303',
    date: '2026-06-09',
    title: 'Release 2.2.430: safer admin data updates with preview before apply',
    highlights: [
      'Organization admins can now preview reference-data updates before applying them',
      'Preview reports clearly show what is new, changed, or no longer active',
      'This helps reduce accidental large data changes during update runs',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Added a two-step admin update flow for reference data: Preview first, then Apply.',
          'Added a clear summary report that shows counts and sample items before any changes are written.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved update safety by making review-first workflows easier for admins.',
          'Improved reliability when running admin update actions without optional request fields.',
        ],
      },
    ],
  },
  {
    version: '2026.06.302',
    date: '2026-06-09',
    title: 'Release 2.2.429: mobile alerts and tab navigation are clearer and more reliable',
    highlights: [
      'Mobile alerts now refresh the right area more consistently after you open a notification',
      'Push setup on mobile is more reliable in production builds',
      'Mobile tab navigation is now organized into clearer Operations and Community flows',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a case where opening some mobile notifications could refresh the wrong section of the app.',
          'Fixed a push setup edge case so mobile notification token registration is more reliable.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved mobile tab organization by grouping screens under clearer Operations and Community navigation flows.',
          'Added a dedicated bounty flow structure so bounty list, detail, and claim screens stay connected more clearly.',
          'Aligned mobile notification setup with your existing notification preference behavior.',
        ],
      },
    ],
  },
  {
    version: '2026.06.301',
    date: '2026-06-09',
    title: 'Release 2.2.428: cross-system analytics now loads more clearly and reliably',
    highlights: [
      'If you open cross-system analytics without an active organization, you now get a clear next-step message instead of a generic load error',
      'Trend views now follow the same time-window rules so sections line up better',
      'Analytics loading was improved behind the scenes to reduce delays on larger datasets',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a case where cross-system analytics could fail to load when no organization was selected.',
          'Fixed inconsistent trend-period handling that could make some analytics sections look out of sync.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Added a clearer organization-required state on the cross-system analytics page to guide the next step.',
          'Improved analytics processing so key cross-system metrics load more smoothly.',
          'Added matching Help Center guidance for quick troubleshooting when analytics does not load as expected.',
        ],
      },
    ],
  },
  {
    version: '2026.06.300',
    date: '2026-06-09',
    title: 'Release 2.2.427: dashboard panels collapse cleaner and overview cards open reliably',
    highlights: [
      'Collapsing a dashboard panel now shrinks the whole panel, not just the inside content area',
      'Overview cards now open their detail pages more reliably when clicked',
      'Dashboard route checks were expanded so overview cards keep going to the right page',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a layout issue where collapsed dashboard panels could still take too much vertical space.',
          'Fixed an interaction issue where overview cards could miss navigation clicks from some card regions.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved dashboard route consistency so each overview card opens the correct destination page.',
          'Added stronger dashboard click-path regression tests to protect card routing in future releases.',
          'Updated Help Center dashboard guidance with plain-language tips for collapsed panels and overview card navigation.',
        ],
      },
    ],
  },
  {
    version: '2026.06.299',
    date: '2026-06-09',
    title: 'Release 2.2.426: faster navigation and clearer keyboard guidance',
    highlights: [
      'The desktop header now stays visible while you scroll, so search and shortcuts are always close by',
      'Command palette wording is clearer about searching both pages and people',
      'Navigation remembers collapsed sidebar groups per hub, so your layout stays how you left it',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Improved desktop navigation by keeping the top bar pinned while scrolling.',
          'Updated command palette wording to better explain search for both commands and people.',
          'Added an interactive hidden-breadcrumb menu so shortened paths are still one click away.',
          'Sidebar group collapse state now persists per hub, so your preferred navigation density is remembered.',
          'Keyboard hints are more visible in the top bar, and hub number shortcuts avoid firing while you are typing or interacting with controls.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed mobile top-bar crowding by moving secondary actions into an overflow menu.',
          'Fixed accidental hub jumps when pressing number keys inside interactive controls.',
        ],
      },
    ],
  },
  {
    version: '2026.06.298',
    date: '2026-06-09',
    title: 'Release 2.2.425: Discord RSI status panels now stay in sync more reliably',
    highlights: [
      'RSI status panels in Discord now keep updating more reliably during short Discord service hiccups',
      'If bot presence is updating, panel tracking is now less likely to stop from temporary errors',
      'Help Center now includes quick troubleshooting steps if a panel message ever looks stale',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a panel tracking issue where some temporary Discord API errors could stop an RSI status panel from updating until manually redeployed.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved panel recovery behavior so only clearly stale panel states are removed automatically.',
          'Added clearer Help Center guidance for what to do if panel content briefly looks older than the bot status line.',
          'No settings changes are required for this update.',
        ],
      },
    ],
  },
  {
    version: '2026.06.297',
    date: '2026-06-09',
    title: 'Release 2.2.424: smoother Discord sign-in and public stats refresh',
    highlights: [
      'Discord sign-in and public stats now recover more smoothly after short service reconnects',
      'If you briefly see a delay, one refresh after about a minute should usually clear it',
      'Help Center guidance was updated with quick troubleshooting steps in plain language',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed an issue that could briefly cause Discord sign-in timeouts or outdated public stats after service updates.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved reconnect behavior so public stats refresh more reliably after short restarts.',
          'Added a new Help Center FAQ entry describing what to do first if login or stats briefly look stuck.',
          'No settings changes are required for this update.',
        ],
      },
    ],
  },
  {
    version: '2026.06.296',
    date: '2026-06-08',
    title: 'Release 2.2.423: behind-the-scenes stability and compatibility refresh',
    highlights: [
      'This release focused on maintenance and stability behind the scenes',
      'Extra quality and security checks were rerun to keep updates reliable',
      'You do not need to change any settings or workflow for this update',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Improved behind-the-scenes compatibility maintenance to help routine updates stay smooth.',
          'Completed an additional reliability and safety validation sweep before release.',
          'No user action is required for this update.',
        ],
      },
    ],
  },
  {
    version: '2026.06.295',
    date: '2026-06-08',
    title: 'Release 2.2.422: Discord update notes now appear sooner after restart',
    highlights: [
      'When a new release is available, Discord update notes are checked right away at startup',
      'A quick follow-up check runs shortly after startup to reduce missed first-post windows',
      'Help Center now explains what to expect if your server was just restarted',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a delay where Discord update notes could wait too long before posting after restart.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Update-note checks now run immediately at startup, then run one quick follow-up check shortly after.',
          'This makes new release notes more likely to show up quickly without waiting for the full background interval.',
        ],
      },
    ],
  },
  {
    version: '2026.06.294',
    date: '2026-06-08',
    title: 'Release 2.2.421: Discord update posts are now more reliable',
    highlights: [
      'Discord update posts now stay connected after deployments more consistently',
      'If update posts are being turned on for the first time, older notes are not reposted',
      'Help Center now includes a plain-language explanation for this behavior',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a deployment targeting issue that could prevent update notes from reaching Discord in some environments.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved deployment targeting so Discord update posting stays attached to the correct bot app after releases.',
          'Clarified first-time behavior: update posting starts from the current release and continues with new releases after that.',
        ],
      },
    ],
  },
  {
    version: '2026.06.293',
    date: '2026-06-08',
    title: 'Release 2.2.420: organization activity badges now update automatically',
    highlights: [
      'Organization cards now update activity badges automatically when activity levels change',
      'Badges are less likely to stay stale after your community gets more or less active',
      'Help Center now explains why an organization badge can move up or down over time',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed an issue where public organization activity badges could stay out of date after activity changed.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Public organization cards now refresh activity badges in the background so status is closer to current activity.',
          'This update reduces manual follow-up for organization activity marker accuracy in the directory view.',
        ],
      },
    ],
  },
  {
    version: '2026.06.292',
    date: '2026-06-08',
    title: 'Release 2.2.419: fewer temporary backend connection errors during startup',
    highlights: [
      'Startup reliability was improved so the app is less likely to show temporary backend-unavailable messages',
      'If a short restart does happen, health checks recover more consistently once services are ready',
      'Help content now includes a plain-language troubleshooting tip for this message',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a backend startup issue that could occasionally prevent the service from becoming available after restart in some environments.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Improved startup consistency so app availability checks settle more reliably once backend services are ready.',
          'Added a new Help Center FAQ entry explaining what to do if you briefly see a backend-availability warning.',
        ],
      },
    ],
  },
  {
    version: '2026.06.291',
    date: '2026-06-08',
    title: 'Release 2.2.418: smoother updates and clearer status signals',
    highlights: [
      'This release focuses on reliability and clarity rather than new buttons or screens',
      'Status signals are less likely to look confusing during restarts or short hiccups',
      'Help and release notes were refreshed so guidance is easier to follow',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Improved background startup and status reporting behavior so short restarts are less likely to show mixed or misleading health signals.',
          'Improved update reliability in deployment packaging so web and bot releases are less likely to fail during image builds.',
          'Updated user-facing release notes and FAQ wording to keep support guidance clearer and easier to scan.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed a backend shutdown edge case that could raise avoidable promise-handling warnings during service stop.',
        ],
      },
    ],
  },
  {
    version: '2026.06.290',
    date: '2026-06-08',
    title: 'Release 2.2.417: Discord updates and status checks are more reliable',
    highlights: [
      'Discord-connected actions recover more smoothly after short hiccups',
      'Status checks are now more accurate, so healthy/unhealthy signals are clearer',
      'Release notes and help content now stay aligned from one shared source',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Behind the scenes, Discord update handling was tightened so temporary interruptions are less likely to leave actions stuck.',
          'Service health checks were refined to avoid false-ready signals and give clearer status when parts of the bot are still starting.',
          'Release notes now come from one shared source, helping web and Discord-facing update content stay consistent.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed a readiness-reporting edge case that could briefly report everything as ready before all bot startup checks were truly complete.',
        ],
      },
    ],
  },
  {
    version: '2026.06.289',
    date: '2026-06-08',
    title: 'Release 2.2.416: Feedback & Discussions now opens our Discord community',
    highlights: [
      'The Feedback & Discussions button now opens our Discord invite directly',
      'You can jump into community chat faster from both the landing page and About window',
      'Help Center now explains where to ask questions and share ideas',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Feedback & Discussions now takes you straight to our Discord community invite so you can ask questions and share ideas in one click.',
          'This update is live in both places where the button appears: the landing page stats bar and the About window.',
          'The Help Center FAQ now includes a simple guide on where to go for feedback and community discussion.',
        ],
      },
    ],
  },
  {
    version: '2026.06.288',
    date: '2026-06-08',
    title: 'Release 2.2.415: Discord now shows live RSI server status in bot activity',
    highlights: [
      'The bot activity now includes the current Persistent Universe status from RSI',
      'You can quickly spot if servers are Operational, in Maintenance, or having issues',
      'Status wording now matches the labels used on the official RSI status page',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Discord bot activity now rotates a live status line for Persistent Universe so you can check server health at a glance without opening the status site first.',
          'Status text now uses the same labels as the RSI status page to keep wording familiar and easier to trust.',
        ],
      },
    ],
  },
  {
    version: '2026.06.287',
    date: '2026-06-07',
    title: 'Release 2.2.414: ready-check alerts are quieter and more targeted',
    highlights: [
      'Ready-check alerts now avoid broad thread pings when direct messages are working',
      'If someone cannot receive DMs, only those members are tagged in the event thread as fallback',
      'Ready-check button handling is now more consistent behind the scenes',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Ready checks now stay quieter in Discord: the bot no longer sends broad start pings in event threads when normal DM delivery succeeds.',
          'Fallback tagging is now more targeted, so only members who missed DM delivery get tagged in the event thread and duplicate fallback pings are avoided.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Improved ready-check notification reliability and safety to reduce accidental notification noise during preference lookup problems.',
        ],
      },
    ],
  },
  {
    version: '2026.06.286',
    date: '2026-06-07',
    title: 'Release 2.2.413: joining events no longer assigns a combat role automatically',
    highlights: [
      'Joining an event from Discord now keeps your role neutral by default',
      'You can still choose a ship seat or role later when you are ready',
      'This removes confusing swords icons for people who only wanted to RSVP',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'When you tap Join on an event, Fringe Core now keeps you as a general participant unless you choose a specific seat or role.',
          'Role icons now match your actual choices better, so RSVP status is clearer for everyone in the event thread.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed an issue where some new Join responses in Discord could show a combat-role icon even when no combat role was selected.',
        ],
      },
    ],
  },
  {
    version: '2026.06.285',
    date: '2026-06-07',
    title: 'Release 2.2.412: ready checks are simpler in Discord',
    highlights: [
      'You can now answer ready checks with Yes/No buttons right in the event thread',
      'If a DM cannot be delivered, the bot tags you in the event thread so you still get the alert',
      '/org and /user now include faster fleet and hangar shortcuts for summaries and public sharing',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Ready checks now stay in one place: start from Discord, then vote Yes or No in the event thread.',
          'The /org menu now keeps mirror and ready-check tools together, and /org Fleet has quick Summary, List, and Post Public actions.',
          'The /user Hangar menu now shows live summary views and includes a Post Public option for quick sharing.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed a notification gap where some members could miss a ready-check DM. The bot now tags those members in the event thread as a fallback.',
          'Ready-check updates now stay in sync in the same thread message as votes come in or change.',
        ],
      },
    ],
  },
  {
    version: '2026.06.284',
    date: '2026-06-07',
    title: 'Release 2.2.411: easier event and fleet actions from Discord',
    highlights: [
      'Ready checks now try to DM members first, then fall back to an event-thread mention if DM is blocked',
      'You can now post public fleet and hangar snapshots straight from Discord panel buttons',
      'The /org activities menu now includes ready-check and mirror shortcuts in one place',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'In /org -> Activities, you now get direct buttons for Mirror, Post Mirror, Ready Check, Ready Status, and Cancel Check.',
          'In /org -> Fleet, you can now open a quick Summary, view a Fleet List, post a Public snapshot, or jump to the web fleet page.',
          'In /user -> Hangar, you now get live summary views (ships, insurance, loans, sharing) plus a Post Public button for quick sharing.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Ready check delivery is now more reliable in Discord: if a member cannot receive DMs, the bot posts a fallback mention in the event discussion thread so they still get notified.',
        ],
      },
    ],
  },
  {
    version: '2026.06.283',
    date: '2026-06-06',
    title: 'Release 2.2.410: Comm Link messages keep flowing after quiet periods',
    highlights: [
      'Comm Link (cross-server) chat now keeps relaying reliably, even after a channel has been quiet for a long time',
      'Connections and changes made on another server are picked up automatically — no need to relink',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed an issue where Comm Link messages could stop appearing in connected servers after a long period of inactivity.',
          'Comm Links now automatically refresh which channels are connected, so your messages reach every linked server again on the next message.',
        ],
      },
      {
        category: 'improved',
        items: [
          'If a connected server is added, removed, or changed elsewhere, your Comm Links now notice on their own instead of relaying to an out-of-date list.',
        ],
      },
    ],
  },
  {
    version: '2026.06.282',
    date: '2026-06-06',
    title: 'Release 2.2.409: RSI Status settings now save reliably on the web',
    highlights: [
      'Discord Settings → RSI Status now loads your current panel and channel setup correctly',
      'Saving RSI panel and status-channel changes from the web now works reliably again',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed an issue where the RSI Status tab in Discord Settings could fail to load current settings in some deployments.',
          'Fixed an issue where panel deploy/remove and status-channel updates from the web RSI tab could fail to save.',
        ],
      },
      {
        category: 'improved',
        items: [
          'When the bot is temporarily unavailable, the RSI Status tab now returns a clearer error message so you know to retry instead of guessing what happened.',
        ],
      },
    ],
  },
  {
    version: '2026.06.281',
    date: '2026-06-06',
    title: 'Release 2.2.408: RSI live panel now shows maintenance more clearly',
    highlights: [
      'The live RSI panel now shows a wrench (🔧) during maintenance instead of looking like an unknown status',
      'RSI app and game-server status labels stay more accurate during maintenance windows',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a status display issue where maintenance periods could appear as “Unknown” in some RSI panel views.',
          'The live panel now uses the same icon rules as status channels, so maintenance is shown consistently with the wrench icon (🔧).',
        ],
      },
      {
        category: 'improved',
        items: [
          'RSI status updates are now easier to read at a glance during active incidents and maintenance windows.',
        ],
      },
    ],
  },
  {
    version: '2026.06.280',
    date: '2026-06-05',
    title: 'Release 2.2.407: RSI status tools are now easier to find in /org',
    highlights: [
      'Server admins can now open RSI Status directly from /org without remembering a separate command first',
      'The /org RSI menu gives quick buttons for status check, live panel, status channels, and panel removal',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Added an RSI Status button to the /org command hub in Discord. This gives admins one place to reach all status tools.',
          'From the new /org RSI Status menu, you can check current RSI status, post a live status panel, manage status channels, or remove an old panel.',
          'This change is about easier access only. Existing RSI status features and behavior stay the same.',
        ],
      },
    ],
  },
  {
    version: '2026.06.279',
    date: '2026-06-05',
    title: 'Release 2.2.406: comm links now relay more consistently',
    highlights: [
      'Cross-server comm link messages now show up more reliably in connected servers',
      'Link by Code now joins password-protected comm links more reliably',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed a comm link reliability issue where some messages could fail to appear in connected servers. Delivery is now more consistent across linked channels.',
          'If a comm link is set to allow bot messages, those bot updates now relay as expected instead of being dropped.',
          'Fixed a Link by Code issue for password-protected comm links so join attempts no longer fail because of input ordering behind the scenes.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Comm link delivery now does a better job avoiding accidental duplicate loops while still forwarding valid messages.',
        ],
      },
    ],
  },
  {
    version: '2026.06.278',
    date: '2026-06-05',
    title: 'Release 2.2.405: clearer Discord event settings and more reliable event automation',
    highlights: [
      'Discord Settings now gives you a timezone dropdown with common picks plus the full list',
      'The two event automation switches now work consistently, including when events are created from the Discord wizard',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'In Discord Settings → Events, the server timezone field is now a guided picker. You can choose from common timezone options quickly or open the full timezone list if you need something specific.',
          'The “Create Discord calendar event” and “Create event discussion thread” settings are now applied reliably whenever a new event is created from the platform.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed a bug where those two event settings could appear saved but be ignored in some create-event paths. They now take effect consistently in both normal event creation and the Discord step-by-step event wizard.',
        ],
      },
    ],
  },
  {
    version: '2026.06.277',
    date: '2026-06-05',
    title: 'Release 2.2.404: faster Discord event button responses',
    highlights: [
      'Discord event buttons now feel snappier, with a shorter wait if you tap quickly',
      'Using one Ship & Crew action no longer pauses different actions in the same menu',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Reduced the short anti-spam wait on Discord event buttons from 3 seconds to about 2 seconds.',
          'Button pacing now applies per action (for example, Join Crew vs Join as Passenger), so using one action does not block a different one right after it.',
        ],
      },
    ],
  },
  {
    version: '2026.06.276',
    date: '2026-06-05',
    title: 'Release 2.2.403: smoother RSI affiliation refresh when RSI is busy',
    highlights: [
      'If RSI is briefly busy, affiliation refresh now retries once automatically before showing an unavailable status',
      'This reduces one-off sync interruptions and helps profiles recover without extra manual retries',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Improved RSI affiliation refresh reliability. When RSI temporarily rate-limits requests, Fringe Core now waits a short moment and retries once automatically before marking the refresh as unavailable.',
        ],
      },
    ],
  },
  {
    version: '2026.06.275',
    date: '2026-06-05',
    title: 'Release 2.2.402: Mirror button for organisers, Manage Slots for ship owners',
    highlights: [
      'Event organisers can now mirror an event to other servers straight from the event card with a new “Mirror” button',
      'Manage Slots moved into the Ship & Crew menu, so any ship owner can set their own ship’s crew and passenger slots — no organiser rights needed',
      'Bringing a fleet to an event now DMs each member to accept or decline, and lets them choose whether to loan their own ship',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Event organisers now have a “Mirror” button on the event card. Tap it to create (or re-show) a share code for that exact event, so it can be mirrored to other servers — no need to pick the event from a list first.',
          'Manage Slots is now in the “Ship & Crew” menu instead of the organiser-only row. If you own or contributed a ship to an event, you can edit its crew and passenger slots yourself.',
          'Bringing a fleet to an event now asks each member personally. Everyone in the fleet gets a DM (and the usual invite on the event card) to Join or Decline, and if they have their own ship in that fleet they can choose to join with it or without it. Nobody’s ship is added or removed without their say-so.',
        ],
      },
    ],
  },
  {
    version: '2026.06.274',
    date: '2026-06-05',
    title: 'Release 2.2.401: tidier Discord event cards with a Ship & Crew menu',
    highlights: [
      'Discord event cards are far less cluttered — the ship, crew, and passenger actions now live behind a single “🚀 Ship & Crew” button that opens a quick menu',
      'Bring Fleet is now in that menu too, so any fleet leader can add their fleet (not just the event organiser)',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Discord event cards now show just two rows for members: the RSVP buttons and a single “Ship & Crew” button. Tapping it opens a private menu with Bring Ship, Bring Fleet, Join Crew, Join as Passenger, Remove Ship, Leave Crew, Leave Seat, and Request Ships — so the card stays compact while every action is still one tap away.',
          'Bring Fleet moved into the new Ship & Crew menu and is now available to any fleet leader, not just the event organiser.',
          'Event organisers keep a slim management row (Edit Event, Manage Slots, Cancel Event).',
        ],
      },
    ],
  },
  {
    version: '2026.06.273',
    date: '2026-06-05',
    title: 'Release 2.2.400: colorful progress bars on Discord',
    highlights: [
      'Progress bars on Discord (like event seats filling up, poll results, and group-finder spots) now show a colorful red-to-green gradient that fills up as they get closer to full',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Discord progress bars are now easier to read at a glance. Instead of a plain bar, they fill with color — starting red when nearly empty and warming through orange and yellow to green as they fill up. You will see this on event seats and roles filling up, ship crew and fuel, poll results, and group-finder (LFG) spots.',
        ],
      },
    ],
  },
  {
    version: '2026.06.272',
    date: '2026-06-05',
    title: 'Release 2.2.399: event crew and ship updates now stay in sync everywhere',
    highlights: [
      'When someone joins or leaves a ship, changes their crew role, or grabs a passenger seat, the event now updates instantly both on Discord and on the web',
      'Joining a ship’s crew now works even for ships added with the Bring Ship button — no more members stuck as “crew without a ship”',
      'The Bring Fleet button now correctly sees your fleet’s ships instead of saying the fleet is empty',
      'When you have a big hangar, the Bring Ship menu now groups your ships so the full list is always reachable',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Event rosters now stay in sync everywhere. Joining or leaving a ship, switching crew roles, or taking a passenger seat now refreshes the event card right away on both Discord and the web, instead of quietly saving and looking unchanged.',
          'Joining a ship as crew now works for ships added through the Bring Ship button. Previously the bot could not find those ships, so the member ended up listed as “crew without a ship” and the Discord card never updated.',
          'The Bring Fleet button now finds your fleet’s ships correctly. It no longer says a fleet has no ships to bring when it actually does, and the fleet picker shows the right ship count.',
          'The Bring Ship menu no longer hides ships when your hangar is large. Your ships are now organized into groups (by role and alphabetically) so you can always reach every ship instead of seeing a cut-off list.',
        ],
      },
    ],
  },
  {
    version: '2026.06.271',
    date: '2026-06-05',
    title:
      'Release 2.2.398: jump straight to the web app from Discord, smarter polls, and live RSI status channels',
    highlights: [
      'Poll, group-finder, bounty, and mission cards in Discord now have clickable titles that open the matching page in the web app',
      'The /user, /org, and /federation menus in Discord now offer quick links straight to the related web pages',
      'Voting on a poll counts as the same person whether you vote in Discord or on the web, so you are never double-counted — and the results now open automatically once you vote',
      'Admins can now show live RSI service status right in a Discord channel name with a colored status dot — one channel for the RSI app and one for the game servers',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Discord poll, group-finder (LFG), bounty, and mission cards now link their titles to the matching page in the web app, so you can jump from Discord to the full view in one tap.',
          'The /user, /org, and /federation Discord menus now include handy buttons and links that take you straight to the related pages in the web app.',
          'New live RSI status channels: an admin can have the bot keep a Discord channel name in sync with RSI’s platform and game-server status, shown with a colored status dot. The bot can create the channels for you, or you can point it at channels you already have by searching for them in a dropdown — easy even on big servers.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Polls now work the same whether you vote in Discord or on the web — your vote is recognized as one person on either side, so nothing gets counted twice. On Discord you can tap an option again to change or clear your choice, and on the web the results now open up automatically as soon as you vote.',
          'Event card buttons are easier to read: the decline button is now a neutral color so its mark stands out, and joining as a passenger now shows a seat icon.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Notification buttons in Discord now properly check that you have the Manage Server permission before changing server-wide options, while your own personal notification preferences stay available to everyone.',
        ],
      },
    ],
  },
  {
    version: '2026.06.270',
    date: '2026-06-05',
    title: 'Release 2.2.397: more reliable cross-server comm link messages',
    highlights: [
      'Comm link messages no longer go missing when a connected channel’s relay was reset behind the scenes',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fixed an issue where a cross-server comm link could occasionally drop a single message if the connection to a channel had been reset. The bot now repairs the connection on the spot and delivers your message, so nothing gets lost.',
        ],
      },
    ],
  },
  {
    version: '2026.06.269',
    date: '2026-06-04',
    title:
      'Release 2.2.396: safer account linking, more reliable Discord commands, and extra protection against abusive requests',
    highlights: [
      'If you click an older Discord panel button, the bot now clearly tells you to refresh with /user or /org instead of failing silently',
      'Discord command menus stay visible more reliably after the bot restarts or updates, even during rollouts',
      'Connected account sign-in now double-checks that you always land back on the right page',
      'Added extra safeguards that block overly complex requests designed to slow the platform down',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Added a new safeguard that blocks overly complex requests to help keep the platform fast and stable.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord buttons now tell you exactly what to do next when you tap one from an older message.',
          'Discord commands stay available more consistently after updates, and the bot can refresh them on its own when needed.',
          'Connecting an outside account (like Google, Twitch, or Discord) now uses stricter checks so you are always returned to the right page.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Older Discord buttons now open the correct up-to-date actions for a smoother experience after updates.',
          'Corrected an internal security-scanning setting so our automated security checks keep running reliably.',
        ],
      },
    ],
  },
  {
    version: '2026.06.268',
    date: '2026-06-04',
    title: 'Release 2.2.395 hotfix: smoother Discord bot startup and clearer server-link help',
    highlights: [
      'The Discord bot now starts up reliably across different setups, reducing startup failures',
      'When the bot comes online, it refreshes its commands for servers it is already in, so they stay up to date faster',
      'Recruitment, ticket, and verification messages now point admins to the current server-link steps instead of outdated instructions',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'The Discord bot now starts up reliably across different configurations, making updates smoother.',
          'When the bot comes online, it refreshes commands for servers it is already in, so you do not get outdated commands after an update.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'When a server is not linked yet, recruitment, tickets, and verification now point you to the current /org setup steps instead of the old /sc-link instructions.',
          'The Discord bot now starts up more reliably by only loading what it needs, when it needs it.',
        ],
      },
    ],
  },
  {
    version: '2026.06.267',
    date: '2026-06-04',
    title:
      'Release 2.2.395: streamlined Discord command hubs, safer activity close-out rules, and stronger sync reliability',
    highlights: [
      'Discord slash commands are now organized around three top-level hubs: /user, /org, and /federation',
      'Only the person who created an activity can complete or cancel it, and this now works consistently for both organization and personal activities',
      'Discord scheduled events and their linked voice channels now stay in sync more reliably when activities are cancelled, rescheduled, completed, or deleted',
      'The Discord bot and platform now recover more gracefully from expired sign-ins, so bot panels fail less often',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'New top-level Discord command hubs: /user for member tasks, /org for organization tasks, and /federation for federation administration.',
          'Expanded button-first navigation so common tools stay reachable through hub buttons without memorizing a long list of slash commands.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Verification and role-sync tools are now easier to find in the new command hubs, with all the same admin options.',
          'Completing or cancelling an activity now stays in sync between the web app and Discord, including reschedules.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed an issue where Discord events could get out of sync if they could not be removed during a cancellation.',
          'Improved how the bot refreshes its sign-in, reducing occasional bot panel failures.',
        ],
      },
    ],
  },
  {
    version: '2026.06.266',
    date: '2026-06-02',
    title:
      'Release 2.2.394: clearer RSI verification admin shortcuts and removal of an unused setup flow',
    highlights: [
      'Organization admins with Manage Roles now get RSI sync shortcuts directly in the /verify panel (Sync Status, Setup Wizard, Run Sync, Audit)',
      'RSI sync admin actions work consistently whether you use /verify or /rsisync',
      'The unused Migration Wizard has been removed',
      'Personal Hangar filters now behave more consistently',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'The RSI verification panel now shows admin sync shortcuts when your Discord role includes Manage Roles, while everyday verification stays the same.',
          'Admin sync actions now work the same way across /verify and /rsisync, so buttons behave consistently.',
          'Personal Hangar filters now behave more predictably.',
        ],
      },
      {
        category: 'removed',
        items: ['The Migration Wizard page and its related tooling were removed.'],
      },
    ],
  },
  {
    version: '2026.06.265',
    date: '2026-06-02',
    title:
      'Release 2.2.393: a stable Android download link, safer release rollouts, and behind-the-scenes reliability improvements',
    highlights: [
      'Android users can now download the latest app from a stable link: /mobile/sc-fleet-manager-latest.apk',
      'The Android app download now runs through our servers so the files stay securely stored',
      'Each new Android release is now automatically checked to confirm the download works before it goes live',
      'The team can now switch the platform into maintenance mode during updates, making disruptive updates safer for you',
      'Behind-the-scenes sign-in handling for our cloud services was improved to reduce errors',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'A stable download link for the latest Android release: /mobile/sc-fleet-manager-latest.apk.',
          'A maintenance-mode switch the team can use during planned updates.',
          'An automatic check that confirms each new Android download works before release.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Android downloads now run through our servers so release files stay securely stored.',
          'Added safeguards to make database changes safer during releases.',
          'Behind-the-scenes sign-in to our cloud services is now more consistent and reliable.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Improved internal diagnostics to make database-related issues easier to track down.',
          'The Android download link now always points to the correct, stable address.',
        ],
      },
    ],
  },
  {
    version: '2026.06.264',
    date: '2026-06-02',
    title: 'Release 2.2.391: clearer Discord posting, better ship filtering, and safer bot startup',
    highlights: [
      'Poll posting to Discord now uses the channels you set up in Discord Settings, so you no longer need to enter server and channel IDs by hand',
      'You can post a poll to several of your set-up Discord channels at once, with clear feedback if any of them fails',
      'Personal Hangar now includes Production, Visibility, and Sort controls directly in the filter bar',
      'Organization Ships now supports filtering by Fleet and by Member owner, making large org fleets easier to browse',
      'Bundled ship packages (names like "... with ...") are no longer shown when selecting ships, since they cannot be used correctly there',
      'The Discord bot now stops at startup if a required security key is missing, preventing harder-to-diagnose errors later',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'A selector for posting polls to your set-up Discord channels (choose more than one).',
          'Production status filtering for your ships (Released, Concept, In Production, Announced).',
          'Fleet and Member owner filters on the Organization Ships page.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Top navigation spacing and logo behavior on very small mobile screens for a cleaner header layout.',
          'Personal Hangar filters for sharing, production status, and sorting now work more predictably with browser back and forward.',
          'Discord Settings was reorganized behind the scenes for better long-term reliability.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Ship selection now hides bundled ship packages on both Discord and the web to prevent invalid choices.',
          'Ship filtering continues to work with both older and newer link formats.',
        ],
      },
    ],
  },
  {
    version: '2026.06.263',
    date: '2026-06-02',
    title:
      'Release 2.2.390: passenger seats, typed crew slots, fleet deployment, loot distribution, and guided onboarding',
    highlights: [
      'Activities now support passenger and marine seats — members can request to ride along without needing a crew role',
      'Organizers can define typed crew slots per ship (pilot, gunner, engineer, etc.) so everyone knows exactly which roles are still needed',
      'Fleet leaders can bring their entire fleet into an event in one click — from the activity page or right from the Discord event embed',
      'Discord event embeds have three new action buttons: Join as Passenger, Manage Slots, and Bring Fleet',
      'Missions now have a Loot Distribution panel — create a loot pool, add items (or scan a screenshot), assign shares to participants, and track payouts',
      'RSI account verification now uses a generated link you place in your RSI bio instead of a copy-paste code',
      'A guided onboarding tour now auto-starts for new users; you can re-open it any time from the launcher button in the top navigation bar',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Passenger and marine seat types on activities — request a ride-along spot without filling a crew role',
          'Typed crew slots — define required roles (pilot, gunner, engineer, navigator, cargo, medical) per ship on an activity',
          'Bring Fleet to activity — fleet leaders can attach their entire fleet to an event in a single action',
          'Loot Distribution panel on missions — create a pool, add items manually or by scanning a screenshot, split between participants',
          'Loot pool assistants — track which members helped on a mission and assign them a share of the loot',
          'Guide Mode — interactive product tour that auto-starts on first login; re-launchable from the top navigation bar',
          'Link-based RSI verification — provide your RSI handle, then verify by placing the generated link in your RSI bio',
          'UEE Citizen Record now captured and stored during RSI verification',
          'Demo login for showcasing the platform',
        ],
      },
      {
        category: 'improved',
        items: [
          'Activity detail page reorganised into a two-column layout on wide screens for easier reading',
          'Discord event embeds expanded with Join as Passenger, Manage Slots, and Bring Fleet buttons',
          'Discord event embeds now refresh automatically when an activity is edited on the web',
          'RSI verification Discord bot command updated to match the new link-first flow',
          'Recruitment bot flow rebuilt for more reliable application handling',
          'Treasury and commissary are now covered by permission settings',
        ],
      },
    ],
  },
  {
    version: '2026.05.262',
    date: '2026-05-29',
    title:
      'Release 2.2.389: faster navigation, groundwork for more reliable dues collection, and fresher org updates',
    highlights: [
      'Navigation now behaves more consistently across the sidebar, command palette, and mobile, with better highlighting of the page you are on',
      'Pages you are likely to open next now load sooner, reducing wait time as you move between major sections',
      'Recurring treasury dues now have improved behind-the-scenes tracking to make collection more reliable over time',
      'Background voice and analytics tasks are now more reliable and better tested',
      'Organization and fleet views refresh more reliably after you make changes',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Pages you are likely to visit next now preload, so common pages open faster.',
          'Groundwork for more reliable recurring treasury dues collection, with day-by-day tracking.',
          'Help Center notes for when you hear about a release before the feature reaches your account.',
        ],
      },
      {
        category: 'improved',
        items: [
          'The command palette, sidebar, and mobile navigation now stay in better sync when highlighting the page you are on.',
          'Organization and fleet changes now show up more consistently right after you make them.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Added safeguards and tests to prevent background analytics and voice-tracking tasks from running twice or misbehaving.',
          'Expanded automated testing across fleet, activity, and import/navigation features to reduce unexpected breakage.',
        ],
      },
    ],
  },
  {
    version: '2026.05.260',
    date: '2026-05-27',
    title: 'Safer sign-in handling, easier RSI sync admin actions, and stronger security defaults',
    highlights: [
      'Org admins now get RSI sync controls directly in the Discord /verify panel (Status, Setup Wizard, Run Sync, Audit) when they have Manage Roles',
      'The old Microsoft sign-in address now clearly points to the current one',
      'Browser security is stricter, with tighter limits on what scripts can run for better protection',
      'Behind the scenes, encryption and logging now validate more strictly and do a better job of hiding sensitive information',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Discord /verify now includes admin RSI sync controls for members with Manage Roles: Sync Status, Setup Wizard, Run Sync, and Audit',
          'Our automated security checks now include additional scanning layers to catch issues earlier',
        ],
      },
      {
        category: 'improved',
        items: [
          'Microsoft sign-in now uses the current address, with clear guidance if an old link is used',
          'Browser security settings are more defensive, with stricter limits on scripts and forms',
          'Encryption now checks data for validity before processing it, guarding against corrupted input',
        ],
      },
      {
        category: 'fixed',
        items: [
          'When the Discord sign-in refresh runs into an error, sensitive details are now removed before anything is logged',
          'Sensitive fields like sign-in tokens and keys are now consistently hidden before any logging',
        ],
      },
    ],
  },
  {
    version: '2026.05.259',
    date: '2026-05-27',
    title: 'Remove ships from Discord events, clickable event titles, fresher trade routes',
    highlights: [
      'New "Remove Ship" button on Discord event embeds — pick from a list of the ships you brought and drop one cleanly; displaced crew get reassigned automatically',
      'Event titles in Discord are now clickable and link straight to the event on Fringe Core (public events go to the Opportunities page)',
      'Discord event crew lists now show up to 10 members in a 2-column layout, with a "…and N more" overflow line for big crews',
      'Editing an event in the platform now refreshes both the original Discord message and any mirrored copies in federation servers',
      'Trade routes are now restricted to reports from the last 3 days for fresher pricing, and the disclaimer is updated to match',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Discord event embeds have a new red "Remove Ship" button next to "Bring a Ship" — choose any ship you contributed to drop it from the event',
          'When you remove a ship, anyone crewing it gets moved to another ship you brought if they were already aboard one, otherwise they are released from ship assignment',
          'Discord event titles are now clickable links back to the activity on Fringe Core (public events link directly to the Opportunities view)',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord event embeds now show up to 10 crew members per ship in a 2-column grid (was 4 in a list) with a "…and N more crew members" line when the ship is larger',
          'Editing an event now refreshes the original Discord announcement along with all mirrored copies in federation servers — both update at the same time',
          'Top trade routes now enforce a 3-day freshness window and the in-app disclaimer says so',
          'Voice server "users online" count no longer drops to zero in certain cases — the reported count is now preserved',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed trading routes so creating and deleting routes and price alerts always works (a previous update had broken some of these actions)',
        ],
      },
    ],
  },
  {
    version: '2026.05.258',
    date: '2026-05-26',
    title: 'Personal Hangar bulk-clear, trade route reliability, custom role fixes',
    highlights: [
      'Clear All Ships in Personal Hangar now safely soft-deletes instead of hard-deleting, so loans and fleet assignments are preserved and the action no longer fails on ships referenced elsewhere',
      'Top trade routes are back — switched to the new UEX bulk endpoint after the old one was retired, and routes with missing prices are filtered out instead of showing "N/A"',
      "Adding or importing org members no longer fails when an admin has renamed the default 'member' role (e.g. to 'associate') — the lowest-priority role is used automatically",
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Clear All Ships now reports the actual server error in the confirmation dialog instead of a generic message, and refreshes the hangar summary after completion',
          'Top trade routes no longer fail with "missing required input" after the UEX API change',
          'Org member add and bulk import no longer error out when the conventional "member" role has been renamed',
          'Trade route lists no longer include rows with N/A prices when upstream data is incomplete',
        ],
      },
    ],
  },
  {
    version: '2026.05.257',
    date: '2026-05-26',
    title: 'Post Federation Announcements & Polls to Discord',
    highlights: [
      "Federation announcements can now be posted directly to your federation's central Discord guild with one click",
      'Active federation polls can be pushed to Discord and mirrored so members can vote without leaving Discord',
      'Mirrored event embeds across guilds now refresh automatically when an event is edited',
      'Voice server integration can be saved while disabled without filling in host/port',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'New "Post to Discord" actions on the Federation manage page for announcements and polls',
          'Discord poll mirroring from the federation Polls page (votes stay in sync with the platform)',
          'Mirror-refresh signal so cross-guild event embeds update without manual resync',
        ],
      },
      {
        category: 'improved',
        items: [
          'Joining a ship as crew now works even when the activity only has a stable shipId (no more "Ship not found" on older activities)',
          'Crew selector in Discord disambiguates ships sharing the same owner, eliminating wrong-ship joins',
          'Voice server settings can be saved with the integration toggled off (host/port no longer required when disabled)',
        ],
      },
    ],
  },
  {
    version: '2026.05.256',
    date: '2026-05-26',
    title: 'RSI Org Graph Temporarily Removed for Rework',
    highlights: [
      'The new RSI Organization Graph in Intel Vault has been temporarily removed while we rework the architecture',
      'Background RSI affiliation data refresh continues to keep your intel up to date',
      'No other features were impacted by this change',
    ],
    changes: [
      {
        category: 'removed',
        items: [
          'RSI Intel Organization Graph tab and visualization have been removed from Intel Vault pending an architectural rework. The feature will return in a future release with improved performance and richer controls.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Background affiliation refresh continues to run, so when the graph returns the underlying data will already be warm.',
        ],
      },
    ],
  },
  {
    version: '2026.05.255',
    date: '2026-05-26',
    title: 'RSI Intel Organization Graph & Affiliation Batch Refresh',
    highlights: [
      'New RSI Org Intelligence Graph under Intel Vault — visualize org interconnections, member affiliations, and cross-org linkages',
      'Organizations classified by lifecycle status: active, deleted, banned, unavailable, or virtual (discovered via affiliation)',
      'Member accounts tracked for lifecycle: active, deleted, banned, unavailable, hidden, redacted',
      'Background affiliation batch refresh keeps intel data fresh automatically',
      'Analyst toggles for org lifecycle and account visibility let you filter the graph precisely',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'RSI Intel Organization Graph: interactive SVG node graph showing org relationships based on shared membership and cross-org affiliations.',
          'Tenant-scoped graph: each organization sees an enhanced view filtered by their diplomacy and federation relationships.',
          'Organization lifecycle and member account status tracking with colour-coded chips and table columns.',
          'Analyst controls: toggles for includeDeletedOrgs, includeBannedOrgs, includeUnavailableOrgs, includeVirtualOrgs, includeDeletedAccounts, includeBannedAccounts, includeUnavailableAccounts, includeHiddenAccounts, includeRedactedAccounts.',
          'Background RSI affiliation batch refresh job that proactively crawls stale handles and keeps affiliation data warm.',
          'Redis-backed response cache with configurable TTL, SHA256 key per filter+scope combination.',
          'Summary dashboard chips showing real-time metrics: org counts, member categories, cache status, refresh queue depth.',
          'Edge detail table showing top org interconnections with shared/main/affiliate/redacted counts.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Graph service refactored for maintainability — extracted 20+ helper methods without changing behavior.',
          'Affiliation expansion uses cached data with queued background refresh for stale handles, reducing request-time latency.',
        ],
      },
    ],
  },
  {
    version: '2026.05.254',
    date: '2026-05-26',
    title: 'Auto-LFG Posts to the Right Channel & Mentions Roles',
    highlights: [
      'Auto-LFG posts now go to your configured LFG channel instead of falling back randomly',
      "The first /lfg command you run in any channel automatically sets it as your server's LFG channel",
      'Auto-LFG posts respect the LFG Mention Role setting, so your community gets notified',
      'You can override the channel anytime from LFG Settings in Discord',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          "Auto-LFG posts were being sent to an unpredictable channel because the bot wasn't reading the configured LFG channel ID. Now it reads the canonical lfgChannelId setting correctly.",
          'Auto-LFG respects your LFG Mention Role setting and includes the role mention in each post, matching the behaviour of /lfg create posts.',
        ],
      },
      {
        category: 'improved',
        items: [
          "The /lfg command panel now automatically captures the channel it's posted in as your server's LFG channel (on first run only). You don't need to manually configure it.",
          'Auto-LFG channel selection follows a smart fallback order: configured LFG channel → other-games channel (for non-Star Citizen games) → public LFG channel → system channel → first available text channel.',
          'You can always override the auto-captured channel via your web app LFG Settings panel.',
        ],
      },
    ],
  },
  {
    version: '2026.05.253',
    date: '2026-05-26',
    title: 'Repost Mirrored Events, Smoother Invitations & FleetView Imports',
    highlights: [
      'Clicking Post Mirror again in the same target server now reposts successfully instead of showing an "already mirrored" rejection',
      'Reposts work even when the source event is already at its mirror limit',
      'Org invitation lists, approvals, accepts and declines now load and update reliably',
      'FleetView imports accept more JSON shapes — paste a raw ship array, a wrapped object, or upload a file',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Resolved an issue where reposting a previously mirrored event in the same server could fail with "This event is already mirrored in this server."',
          'Reposting now reuses the existing mirror link and publishes a fresh mirrored event message in the selected target channel.',
          'Fixed invitation pages and actions (list, approve, reject, accept, decline) that could break or show empty results due to a response-handling bug in the frontend.',
          '/events mirror now shows a clear error if the mirrored message cannot be posted (for example when the bot is missing send or embed permissions in the target channel), instead of failing silently.',
          'FleetView Import accepts a wider range of JSON shapes — raw ship arrays, wrapped { "ships": [...] } objects, and stringified JSON in the request body all work consistently.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Mirror reposts are no longer blocked by the per-event mirror cap when they target an already existing active mirror in that server.',
          'The newest reposted mirror message becomes the active synchronized message for ongoing RSVP updates.',
          'FleetView schema validation now logs the underlying parse error server-side while still returning a clean validation message to the UI.',
        ],
      },
    ],
  },
  {
    version: '2026.05.252',
    date: '2026-05-26',
    title: 'Quieter, More Accurate Server Logs',
    highlights: [
      'Expected user-facing 404s (such as a missing image) are no longer recorded as server errors',
      'Real server failures stand out more clearly in operational monitoring',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Internal log levels have been corrected so that ordinary client errors (404, 400, 401, 403, 409) are logged as warnings instead of errors. Real 5xx server failures continue to be logged at error level with full diagnostic detail.',
          'No user-visible behaviour changes. HTTP responses, status codes, and error messages returned by the API are unchanged.',
        ],
      },
    ],
  },
  {
    version: '2026.05.251',
    date: '2026-05-26',
    title: 'Mirrored Discord Events Now Show Full Details and Working Buttons',
    highlights: [
      'Mirrored event messages in partner servers now look identical to the original event',
      'RSVP, Ship/Crew, and Cancel buttons now work on mirrored copies, not just the source',
      'Ship assignments, crew sections, and role requirements are now included on mirrors',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Mirrored event messages were previously a minimal embed (title, description, date, location, source, participants only) and had no action buttons, so members in partner servers could not RSVP or join a ship from the mirror.',
          'Mirrored events now render with the same rich embed (ships, crew, roles, badges) and the same interactive buttons as the source event, both on initial mirror post and on later RSVP-driven updates.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Mirror posts now include a "🎟️ Invite Code" field and a footer note ("RSVP syncs across servers") to make it clear the mirror is interactive and synchronized.',
          'Cross-server RSVP sync continues to update the mirrored embed in real time, and the updated embed now keeps full ship/crew/role parity with the source.',
        ],
      },
    ],
  },
  {
    version: '2026.05.250',
    date: '2026-05-26',
    title: 'Alliance Count Now Includes Federations in Public Stats',
    highlights: [
      'Landing page and Public Stats now show a single Alliances count that includes federations',
      'Public counters are now consistent because the rollup happens at API level for all consumers',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Resolved split-counter confusion where Alliances and Federations were shown as separate totals in public stats views.',
          'Public stats now use one consolidated Alliances total that already includes federations.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Stats behavior is now consistent across Landing and Community Hub → Public Stats because all consumers receive the same rolled-up alliance value from the API.',
        ],
      },
    ],
  },
  {
    version: '2026.05.249',
    date: '2026-05-26',
    title: 'Sent Invitations Update Instantly After You Invite',
    highlights: [
      'After you invite a member, the Sent Invitations panel now updates immediately without reloading the page',
      'Leaders can stay on Members & Roles and confirm invite delivery right away',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Resolved cases where Members & Roles → Sent Invitations could still show "No invitations" immediately after a successful invite send.',
          'The Sent Invitations list now re-fetches as soon as an invite is successfully sent from Invite Member, so the new record appears right away.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Invitation tracking flow is now smoother for org leaders because manual page refresh is no longer required after sending invites.',
        ],
      },
    ],
  },
  {
    version: '2026.05.248',
    date: '2026-05-26',
    title: 'Inter-Org Security and Discord Cross-Org Pickers Are More Reliable',
    highlights: [
      'Inter-Org Security now finds target organizations from active relationships, diplomacy treaties, and federation memberships',
      'Discord LFG Cross-Organization settings now use the same unified source model and clearer empty/loading states',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Resolved common cases where Inter-Org Security showed no target organizations even when valid treaty or federation connections existed.',
          'Cross-Organization LFG organization lists in Discord Settings now consistently include active diplomacy, federation, and positive relationship sources.',
          'Duplicate and inconsistent option-building logic was removed so organization pickers now behave consistently across affected screens.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Dropdown empty states now explain all supported cross-org sources instead of implying diplomacy relationships are the only source.',
          'Organization context fallback handling in Discord Settings was hardened to reduce false empty states when active org context is temporarily unavailable.',
        ],
      },
    ],
  },
  {
    version: '2026.05.247',
    date: '2026-05-26',
    title: 'Discord Ticket Category and Inbox Reliability Fix',
    highlights: [
      'Tickets created from Discord now keep the selected category (HR, Recruitment, Diplomacy, General, or Technical Support)',
      'Ticket confirmation and "My Tickets" now stay reliable even when API responses use different envelope formats',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Creating tickets from the Discord panel now preserves the expected category and creator mapping across mixed bot/API version deployments.',
          'The Discord "My Tickets" view now correctly renders ticket lists from both wrapped and direct API response formats, reducing cases where tickets appeared missing.',
          'Ticket creation confirmations now recover safely if the first API payload omits ticket number details, so you still get the correct ticket reference.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord ticket flows now include stronger compatibility handling for older/newer backend payload variants, improving inbox consistency during rolling updates.',
        ],
      },
    ],
  },
  {
    version: '2026.05.246',
    date: '2026-05-26',
    title: 'Organization Fleet Now Includes Publicly Shared Member Ships',
    highlights: [
      'Member ships set to Public sharing now appear correctly in Organization Fleet ship selection and availability views',
      'Organization admins now get consistent member-ship visibility across Public, Organization, and Alliance sharing levels',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Organization Fleet member-ship visibility now includes ships shared at Public level. Previously, some member ships were hidden unless their sharing level was Organization or Alliance.',
          'Fleet planners and coordinators should now see the expected full set of eligible member ships when preparing operations.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Help Center guidance was updated to clearly explain which sharing levels and ship states control whether a member ship appears in Organization Fleet.',
        ],
      },
    ],
  },
  {
    version: '2026.05.245',
    date: '2026-05-26',
    title: 'Safer Role Updates and Reliability Cleanup',
    highlights: [
      'Organization role update/delete requests now reject malformed IDs earlier, preventing confusing failures later in the flow',
      'Public directory and job-application data handling now surfaces unexpected errors instead of silently hiding them',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Role-management routes now validate organization and role IDs before processing update/delete requests, improving consistency for admin workflows.',
          'Internal auth regression coverage was expanded to ensure bot-only headers cannot bypass standard token requirements.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Public directory icon rendering helpers were moved into a dedicated UI utility module, keeping API services focused on data access.',
          'Public federation and job-application checks now only return fallback results for expected not-found cases and rethrow unexpected failures for better diagnostics.',
          'Mobile app lint/tooling compatibility was updated for modern ESLint configuration, reducing local setup friction for contributors.',
        ],
      },
    ],
  },
  {
    version: '2026.05.244',
    date: '2026-05-25',
    title: 'Security and Stability Hardening for Bot-Powered Flows',
    highlights: [
      'Discord-backed workflows (recruitment, tickets, and alliance coordination) now run through tighter internal auth guards',
      'Activity quick-join link lookups are now indexed server-side for faster response in larger org datasets',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Improved internal route safety for bot-to-platform requests so only explicitly allowed bot routes can use bot-internal headers.',
          'Improved reliability for Discord action flows by ensuring bot routes are matched before unrelated authenticated routers.',
          'Quick-join token lookups now use a dedicated database index, reducing lookup latency for organizations with high activity volume.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Resolved edge cases where valid bot-triggered actions could return unexpected 401 errors due to route-order interception.',
          'Tightened CSRF bypass scoping so bot-internal exemptions only apply to designated bot integration endpoints.',
        ],
      },
    ],
  },
  {
    version: '2026.05.243',
    date: '2026-05-25',
    title: 'TeamSpeak Voice Access Controls + Live Online Counts',
    highlights: [
      'TeamSpeak servers can now show live online counts in Organization Voice settings',
      'Voice server visibility now follows your organization access rules, and only org leaders can manage voice settings',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Organization Settings → Voice Server now includes TeamSpeak query fields for live status data.',
          'When query details are configured, TeamSpeak cards now show real Current Users and Max Users values.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Voice server connect details now follow your configured access policy before they are shown.',
          'Voice settings management is now consistently limited to Founder, Owner, and Admin roles.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed cases where users could see a shared voice server card but still not have real access to connect.',
        ],
      },
    ],
  },
  {
    version: '2026.05.242',
    date: '2026-05-25',
    title: 'Event Ship Pickers Now Show Your Full Hangar',
    highlights: [
      'Join with Ship and Loan Ships now include your full hangar, even for very large collections',
      'Discord Bring Ship suggestions now scan beyond the first batch, so later ships are no longer hidden',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Activities: the Join with Ship and Loan Ships dialogs now load all pages of your hangar before rendering the ship picker. If your hangar has more than 100 ships, entries beyond the first page now appear correctly.',
          'Discord events: Bring Ship suggestions now query your hangar in pages instead of a fixed first chunk. This fixes cases where ships later in large hangars were missing from the menu.',
          'Mobile profile ship lists now fetch all hangar pages for large collections, matching web behaviour for complete ship visibility.',
          'Improved consistency between web and Discord event flows so ship availability now matches across both experiences.',
        ],
      },
    ],
  },
  {
    version: '2026.05.241',
    date: '2026-05-25',
    title: 'Voice: Multiple Mumble Servers No Longer Step On Each Other',
    highlights: [
      'Multiple Mumble servers can now run side by side without interfering with each other',
      'Existing setups keep working as before, with no migration steps required for most teams',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Voice login tokens are now tied to the specific server they were created for, so revoking one server no longer affects another.',
          'The live channel-view cache is now separated per server, so one refresh does not overwrite another server view.',
          'Voice minute tracking now runs per enabled server, so credits are recorded more accurately across federations and org servers.',
          'Voice settings refresh behavior on the web is now more consistent with the rest of the app.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fixed cross-server collisions where refreshing one Mumble server could replace another server’s live channel data.',
        ],
      },
    ],
  },
  {
    version: '2026.05.240',
    date: '2026-05-25',
    title: 'LFG: Closing a Session Always Records Reputation Now',
    highlights: [
      'Closing an LFG session from Discord now always finalises it and DMs members with feedback buttons — no more sessions that end without a reputation prompt',
      'The LFG reputation panel in Discord now works in every linked server without needing a bot restart',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Closing an LFG session via the Discord Close button now goes through the same finalize-and-record pipeline as the auto-close and manual-complete paths. Reputation is always recorded, and every member receives a DM with feedback buttons (capped at 5 DMs per session to respect Discord per-user limits — larger groups can leave feedback for everyone from the web reputation page).',
          'Clicking Close twice on the same LFG session is now safely idempotent. No duplicate DMs and no double-recorded reputation.',
          'The LFG reputation panel (/lfg → Reputation) now resolves your organization context per guild, so it works in every server your org is linked to even if the Discord shard handling that server has not seen the org since the last restart.',
        ],
      },
    ],
  },
  {
    version: '2026.05.239',
    date: '2026-05-25',
    title: 'Discord LFG Mention Role in Web Settings',
    highlights: [
      'You can now choose the LFG @mention role directly from Discord Settings on the web',
      'The same LFG mention-role setting still works from /notify in Discord for admins who prefer slash commands',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Discord Settings → LFG now includes a new "LFG Mention Role" selector. Pick the role you want pinged when a new LFG post is created.',
          'Clearing the field disables channel role pings for new LFG posts, without affecting Smart Ping DM notifications.',
          'The web form now loads and saves this role consistently with your other LFG settings.',
        ],
      },
    ],
  },
  {
    version: '2026.05.238',
    date: '2026-05-25',
    title: 'Activities: Crew Stations + Ship-in-Ship Drag & Drop',
    highlights: [
      'You can now assign or change crew positions directly on each ship card inside an activity',
      'Smaller ships and vehicles can now be dragged into carrier hangars or cargo bays, then dragged back out when plans change',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Crew Position Controls — on Activity Details, each participant listed under a ship now has a position selector so organizers can set roles like pilot, copilot, gunner, engineer, or medic without leaving the page.',
          'Ship Nesting Drag-and-Drop — ships with hangar or cargo capacity now show dedicated drop zones. Drag a compatible ship by its handle and drop it into Hangar or Cargo to nest it under that carrier.',
          'Quick Un-Nest Target — a top-level "Drop here to un-nest" area now appears while dragging, so moved ships can be returned to top-level quickly.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Nested ships are now shown as compact chips inside their parent carrier card, keeping activity loadouts readable even for multi-ship operations.',
          'Carrier validation now checks nesting rules before applying moves (for example, preventing self-nesting or circular nesting chains).',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Pilot assignment rules are now enforced server-side: the pilot slot stays owner-locked for owner-operated ships, preventing accidental reassignment during crew edits.',
        ],
      },
    ],
  },
  {
    version: '2026.05.237',
    date: '2026-05-25',
    title: 'Discord: Edit Events From a Full Wizard Panel',
    highlights: [
      'The Discord Edit button on event embeds now opens a full wizard panel — one button per field — instead of a cramped 5-input form',
      'You can now edit end date, duration, requirements, and recurrence directly from Discord (previously only available on the web)',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Editing an event from Discord now uses the same kind of category-button panel as creating one. Click Edit on the event embed, then click any field (Title, Description, Location, Start, End, Duration, Max Participants, Requirements, Recurrence) to update just that field in a properly sized prompt. Press Save Changes when you are done, or Cancel to discard.',
          'Multi-line descriptions and requirements are now edited in their own full-size text area, so long event briefs no longer have to be squeezed into a tiny field.',
          'Editing recurrence and recurrence-end-date in Discord — previously web-only — now works the same way as on the web.',
        ],
      },
    ],
  },
  {
    version: '2026.05.236',
    date: '2026-05-25',
    title: 'Voice Servers Page — Now Per-Tenant',
    highlights: [
      "The Voice Servers page now shows every server your org can actually use — your org's server, federation servers, and shared third-party servers",
      'Each server is its own card with live online users, channel tree, and a one-click Join button when a connect URL is set',
      'Founders now have the same voice-server, ship, and inventory edit permissions as owners and admins',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Communication → Voice Servers no longer shows only one shared server. It now combines all servers you can access: your org server, federation servers, and servers shared with your org.',
          'Each accessible server is rendered as its own card showing the server type, who hosts it, "Shared with you" badge when applicable, live stats, and the channel tree refreshed every minute.',
        ],
      },
      {
        category: 'added',
        items: [
          'Empty-state guidance on the Voice Servers page explains exactly how to get a server visible: have your org configure one in Organization Settings → Voice Server, join a federation that runs one, or have another org add you to their sharing whitelist.',
          'Founder role is now accepted alongside Owner and Admin for editing voice-server configuration, organization ships, and organization inventory.',
        ],
      },
      {
        category: 'removed',
        items: [
          'The old standalone platform Mumble panel was removed in favor of the unified server card list. Your org server now appears as its own card.',
        ],
      },
    ],
  },
  {
    version: '2026.05.235',
    date: '2026-05-25',
    title: 'Security Hardening & Voice Server Improvements',
    highlights: [
      'Security checks are tighter for production environments',
      'Public discovery pages stay available after the older v1 API retirement',
      'Voice server configuration panel now supports platform-specific Mumble defaults',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Public directory, job listings, and contact-request pages remain accessible after the v1 API sunset date.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Request safety checks are now stricter to reduce the chance of malformed requests slipping through.',
          'Production setup now fails fast when allowed-site settings are misconfigured, preventing overly broad exposure.',
          'Voice server configuration panel offers platform-specific Mumble defaults and improved form handling.',
        ],
      },
    ],
  },
  {
    version: '2026.05.234',
    date: '2026-05-24',
    title: 'Public Recruitment, Federation Stats & Activity Polish',
    highlights: [
      'Recruitment posts on organization profiles are now visible to anonymous visitors — no account required to read the pitch',
      'Public federation count is now featured on the landing page stats bar and public stats page',
      'Activity ship cards correctly group pilots and crew with avatars and ship names',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Public recruitment visibility — active recruitment posts on `/directory/:slug` org profiles are readable without signing in. The "Apply" call-to-action still requires authentication.',
          'Federation tile on the public stats page and landing page stats bar shows the total number of public federations.',
          'Add Ship dialog now has an optional Description field (up to 2,000 characters) so you can record loadout notes, condition, or any context you want stored with the ship.',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Activity ship cards now display the correct ship name and pilot/crew avatars after a participant joins or leaves a ship — previously the name and avatars could appear stale or missing.',
          'Custom organization roles can now be assigned to members. The member-role update endpoint previously rejected custom role identifiers and only allowed built-in roles.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Personal Hangar insurance is now a free-text field, so you can capture any insurance label or expiry that fits your workflow rather than picking from a fixed list.',
          'Creating an organization role no longer requires explicitly specifying scope — it defaults to "organization", matching what nearly every caller already wanted.',
          'Role updates now accept a `priority` value, letting org admins reorder custom roles without recreating them.',
        ],
      },
    ],
  },
  {
    version: '2026.05.233',
    date: '2026-05-23',
    title: 'Guest Event Participation',
    highlights: [
      'Discord users without a platform account can now join public events directly from the event embed',
    ],
    changes: [
      {
        category: 'added',
        items: [
          "Guest Participation — Discord members who haven't linked a platform account can now click Join on public and listed event embeds. Their identity is tracked by Discord ID.",
          'Guest Role Gating — org admins can optionally require a specific Discord role for guest access to org-scoped events via advanced event settings.',
        ],
      },
    ],
  },
  {
    version: '2026.05.231',
    date: '2026-05-22',
    title: 'Automatic Discord Role & Member Reconciliation',
    highlights: [
      'Discord roles now stay in sync automatically, even if the bot was briefly offline when someone joined or left',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Periodic Role Reconciliation — when Role Sync is enabled in your Discord Settings, the bot now runs a background check on a configurable schedule (default: every hour) to ensure Discord roles match your organization membership. If a member joined while the bot was offline, their ✅ Verified role and nickname are assigned automatically on the next pass. If someone left the org but still has managed roles, those roles are cleaned up. The process is rate-limited to avoid Discord API issues and any failed role operation is retried automatically.',
        ],
      },
    ],
  },
  {
    version: '2026.05.230',
    date: '2026-05-22',
    title: 'Discord Role Auto-Populate in Role Mapping',
    highlights: [
      'The Discord Role field in role mappings now auto-populates from your connected server instead of asking for a role ID',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Role Mapping Discord Roles — when creating or editing a role mapping, the Discord Role dropdown now automatically loads all roles from your connected Discord server. You can search and select a role by name instead of manually copying a role ID. If the roles cannot be loaded, a "Retry" button lets you try again, and you can still enter a role ID manually as a fallback.',
        ],
      },
    ],
  },
  {
    version: '2026.05.229',
    date: '2026-05-22',
    title: 'Recruitment Post Preview on Organization Profiles',
    highlights: [
      "You can now read the full recruitment post directly on an organization's profile page without navigating away",
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Recruitment Post Preview — when viewing an organization\'s profile, the recruitment card now has a "View Full Post" button. Clicking it opens a modal with the complete post: full description, all roles needed, tags, requirements, applicant count, and banner image. No more navigating away from the profile just to read the details.',
        ],
      },
    ],
  },
  {
    version: '2026.05.228',
    date: '2026-05-22',
    title: 'Bring Ship Button Fix',
    highlights: [
      'The "Bring Ship" button on Discord events now works reliably even during brief server hiccups',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Bring Ship on Discord — if loading your hangar fails temporarily, the bot now offers a "Enter ship manually" option instead of showing a dead-end error. You can always register your ship for an event even if the hangar lookup has a hiccup.',
        ],
      },
    ],
  },
  {
    version: '2026.05.227',
    date: '2026-05-22',
    title: 'Voice Server Sharing Suggestions & Security Hardening',
    highlights: [
      'Voice server sharing now suggests federations & allied orgs automatically',
      'Federation voice server access is now properly restricted to members',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Voice Sharing Suggestions \u2014 when configuring voice server sharing, the platform now automatically suggests federations you belong to, co-member organizations, and orgs you have active alliances or positive relationships with. You can add them individually or all at once.',
        ],
      },
      {
        category: 'fixed',
        items: [
          "Federation Voice Access \u2014 viewing another federation's voice server details now properly requires membership in that federation. Previously, any logged-in user could discover voice server host/port information.",
          'Voice Token Security \u2014 voice authentication tokens now expire after 4 hours (previously 24 hours) and use a dedicated secret key instead of sharing the platform authentication key.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Network Security \u2014 strengthened outbound request protection with DNS-level validation to prevent server-side request forgery attacks via DNS rebinding.',
        ],
      },
    ],
  },
  {
    version: '2026.05.226',
    date: '2026-05-22',
    title: 'Temp Voice Channel Delete Delay Fix',
    highlights: [
      'Temporary voice channels now respect the configured delete delay',
      'Channels no longer become stuck when someone briefly rejoins',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Voice Channel Delete Delay \u2014 temporary voice channels created via join-to-create hubs now delete promptly after the configured delay when the last person leaves. Previously, channels could remain for up to a minute (or indefinitely if someone briefly rejoined) due to a tracking bug.',
          'Voice Channel Orphaning \u2014 fixed a bug where a temporary voice channel could become "stuck" and never auto-delete. This happened when someone joined the channel during the deletion countdown and then left again \u2014 the channel lost its internal tracking and was no longer recognized as a temporary channel.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Voice Channel Responsiveness \u2014 deletion timers are now cancelled instantly when someone joins a temporary channel, and the channel responds faster to empty state because it no longer waits for a Discord API call.',
        ],
      },
    ],
  },
  {
    version: '2026.05.225',
    date: '2026-05-22',
    title: 'Discord Ticket System Fix',
    highlights: [
      'Tickets created via Discord now display the correct ticket number',
      '"My Tickets" in Discord now reliably shows your open tickets',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Ticket Number \u2014 creating a ticket via the Discord helpdesk panel no longer shows "Ticket Created: unknown". The ticket number (e.g. TKT-000001) now always appears correctly in the confirmation message.',
          'Discord My Tickets \u2014 clicking "My Tickets" on the Discord ticket panel no longer says "You have no open tickets" when you have tickets. This affected all Discord users, especially those who haven\u2019t linked their Fringe Core account.',
          'Concurrent Ticket Creation \u2014 fixed a rare issue where two tickets created at the exact same moment could collide, causing one to fail. The system now automatically retries with a new ticket number.',
        ],
      },
    ],
  },
  {
    version: '2026.05.224',
    date: '2026-05-22',
    title: 'Comm Link Reaction Relay Fix',
    highlights: ['Reactions on relayed messages now propagate to all connected servers'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Comm Link Reactions \u2014 reacting to a relayed message in a connected server now correctly mirrors the reaction to the original message and all other connected channels. Previously, only reactions on the original message were relayed; reactions on the copies were silently ignored.',
        ],
      },
    ],
  },
  {
    version: '2026.05.223',
    date: '2026-05-22',
    title: 'Recruitment Bot Auth Fix & Ticket Improvements',
    highlights: [
      'Recruitment panel buttons in Discord no longer fail with authentication errors',
      'Ticket creation via Discord is now more reliable',
      'Bot error messages now include diagnostic details for administrators',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Recruitment Buttons \u2014 "View Positions", "Quick Apply", and other recruitment panel buttons in Discord no longer fail with "The bot could not authenticate to the API" errors. The root cause was an internal middleware that tried to look up a synthetic bot user in the database and rejected the request when it wasn\u2019t found.',
          'Ticket Creation \u2014 fixed "Ticket Created: undefined" when creating tickets via Discord. The ticket number is now always displayed correctly in the confirmation message.',
          'Ticket Inbox \u2014 clicking "My Tickets" on the Discord panel no longer says "You have no open tickets" when tickets exist. Tickets created by Discord users who haven\u2019t linked their platform account are now properly visible.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Bot Error Messages \u2014 when the bot encounters an authentication error, the message now includes the specific reason from the API (e.g., "User not found", "invalid bot token") to help administrators diagnose issues faster.',
          'Bot Startup Diagnostics \u2014 the bot now logs a clear warning at startup if the internal API secret is not configured, instead of failing silently on every request.',
        ],
      },
    ],
  },
  {
    version: '2026.05.222',
    date: '2026-05-22',
    title: 'Discord Dashboard Layout Fix',
    highlights: ['Discord Settings page no longer overlaps the sidebar navigation'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Dashboard overlap \u2014 the Discord Settings page content was visually overlapping with the left sidebar navigation on desktop. The page now stays properly contained within the main content area.',
        ],
      },
    ],
  },
  {
    version: '2026.05.221',
    date: '2026-05-22',
    title: 'Mobile Download & Infrastructure Improvements',
    highlights: [
      'Mobile APK downloads now work reliably through our CDN',
      'Storage security hardened — all blob access routed through Azure Front Door',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Mobile APK download \u2014 the /mobile download page was returning a storage error. Downloads are now served securely through our CDN (Azure Front Door) instead of direct blob storage links, improving reliability and download speed.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Infrastructure security \u2014 all public access to the storage account has been removed. Mobile downloads, GDPR exports, and image uploads are now served exclusively through authenticated and CDN-cached channels.',
        ],
      },
    ],
  },
  {
    version: '2026.05.220',
    date: '2026-05-22',
    title: 'Federation Multi-Hub Voice Channels',
    highlights: [
      'Federations can now configure multiple join-to-create hub channels, just like organizations',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Multi-Hub Voice for Federations — federation Discord settings now support multiple hub channels for temporary voice creation. Add as many join-to-create entry points as you need across different categories in your federation central server.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Federation voice settings — the hub channel picker now uses the same multi-select chip interface as organization settings, making it easy to add, view, and remove hub channels.',
        ],
      },
    ],
  },
  {
    version: '2026.05.219',
    date: '2026-05-22',
    title: 'Voice Server Sharing & Whitelist Access',
    highlights: [
      'Share your voice server with federations and trusted organizations',
      'Whitelist-based access control for 3rd-party server sharing',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Federation & 3rd-Party Sharing — your voice server can now be shared with federations (like the Stellar Network Collective) and trusted organizations. Enable sharing in Organization Settings → Voice Server, then add entries to your whitelist. Whitelisted entities can see your server status and provide connect links to their members.',
          'Whitelist management — add up to 50 federations or organizations to your voice server whitelist. Each entry shows the target name and type (Federation or Organization) with easy add/remove controls.',
          'Sharing indicator — when your voice server is shared, the status card shows a chip indicating how many entities have access.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Voice Server tab layout — the Organization Settings → Voice Server tab now focuses on your own server configuration as the primary section, with sharing options integrated directly into the configuration panel.',
        ],
      },
    ],
  },
  {
    version: '2026.05.218',
    date: '2026-05-22',
    title: 'Voice Server Channel Tree & Status Fix',
    highlights: [
      'Platform voice server now shows the live channel tree with connected users',
      'Server type badge correctly displays MUMBLE instead of UNKNOWN',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Voice server type badge — the Platform Voice Server stats panel now correctly shows "MUMBLE" instead of "UNKNOWN".',
          'Channel tree — the Voice Servers page now displays the live channel tree (Root, General, Operations, AFK) with connected users, updated every 60 seconds. Previously showed "Channel tree unavailable" due to a network configuration issue.',
        ],
      },
    ],
  },
  {
    version: '2026.05.217',
    date: '2026-05-22',
    title: 'Auto-Publish for Notification Announcements',
    highlights: [
      'Announcements sent to Discord announcement channels can now be auto-published from the Notifications tab',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Auto-publish (crosspost) toggle — Discord Settings → Notifications now has an "Auto-publish messages in announcement channels" switch. When enabled, any message the bot sends to a Discord announcement channel (📢) is automatically published to all servers following that channel. This works for /announce commands and scheduled announcements. The same toggle already existed in the Events tab for event embeds — now both tabs support it independently.',
        ],
      },
    ],
  },
  {
    version: '2026.05.216',
    date: '2026-05-22',
    title: 'Cross-Org LFG Fix',
    highlights: [
      'Allied organizations now appear correctly in the Cross-Organization LFG settings',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Cross-Organization LFG — diplomacy treaties, federation members, and allied organizations now load correctly in the LFG whitelist and blocklist pickers in Discord Settings. Previously, the "No allied organizations found" warning was always shown even when your org had active alliances or federation memberships.',
        ],
      },
    ],
  },
  {
    version: '2026.05.215',
    date: '2026-05-22',
    title: 'Discord Bot Permission Hardening & New Features',
    highlights: [
      'RSI nickname sync — your Discord name updates to your RSI handle on verification',
      'Recruitment threads auto-archive after accept/deny',
      'Comm link tunnels now auto-create webhooks',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'RSI nickname sync — when you verify your RSI handle, the bot can now automatically set your Discord nickname to your RSI handle. Org admins can enable this in Role Sync settings and choose a format like "{rsiHandle}" or "[{rsiHandle}] {displayName}". Guild owners are skipped (Discord limitation).',
          'Recruitment thread auto-archive — when a staff member accepts or denies a recruitment application, the private review thread is automatically archived to keep the staff channel tidy.',
          'Comm link webhook auto-creation — the bot now creates Discord webhooks automatically for tunnel relay channels, eliminating the need to manually configure webhook URLs. Existing webhooks are reused to avoid duplicates.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Bot permission safety — the bot now pre-checks permissions (Manage Events, Create Private Threads, Manage Webhooks, Manage Nicknames) before attempting Discord actions. If a permission is missing, the bot logs a warning and gracefully skips the action instead of crashing.',
        ],
      },
    ],
  },
  {
    version: '2026.05.214',
    date: '2026-05-22',
    title: 'Voice Server Stats Fix',
    highlights: ['Voice server user counts and max slots now display correctly'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Voice Server stats — the "Users Online" and "Max Slots" values on the Voice Servers page now show the correct numbers. Previously they displayed garbled values due to a data parsing bug.',
        ],
      },
    ],
  },
  {
    version: '2026.05.213',
    date: '2026-05-22',
    title: 'Comm Link Reaction Relay',
    highlights: ['Reactions on comm link messages now sync across all connected servers'],
    changes: [
      {
        category: 'added',
        items: [
          'Comm Link reaction relay — when someone reacts to a message in a comm link channel, the same reaction now appears on the relayed message in every other connected server. Removing a reaction is mirrored too. Both standard emoji and custom server emoji are supported.',
        ],
      },
    ],
  },
  {
    version: '2026.05.212',
    date: '2026-05-22',
    title: 'Bot Live Status',
    highlights: ['The Fringe Core bot now shows live platform stats in its Discord status'],
    changes: [
      {
        category: 'added',
        items: [
          'Bot Rich Presence — the bot now rotates its Discord status every 5 minutes, showing the number of registered pilots, public organizations, public federations, and open recruitment & job opportunities across the platform.',
        ],
      },
    ],
  },
  {
    version: '2026.05.211',
    date: '2026-05-22',
    title: 'Voice Server — Deep Integration',
    highlights: [
      'Voice time tracking now contributes to your CAS score',
      "Who's Online live embed in Discord channels",
      'Secure authentication for Mumble with platform accounts',
    ],
    changes: [
      {
        category: 'added',
        items: [
          "Voice time tracking — your Mumble voice minutes now count toward your organization's Composite Activity Score (CAS). Enabled per-org in Voice Server settings.",
          "Who's Online embed — a live-updating Discord embed showing Mumble server status, channels, and connected users. Pinned in your chosen channel.",
          'Voice authentication — click "Join Server" to get a secure login token for Mumble. Your platform username and org role are synced automatically.',
          'Cross-platform moderation — org admins can mute, kick, or ban users across both Discord and Mumble from a single action.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Channel tree data now updates via push instead of polling for faster, more reliable live status.',
        ],
      },
    ],
  },
  {
    version: '2026.05.210',
    date: '2026-05-22',
    title: 'Voice Server Integration',
    highlights: [
      'Platform Mumble voice server is now live at voice.fringecore.space',
      'Join Server button for one-click Mumble connect',
      'Voice Server configuration available in Organization Settings',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Voice Server tab in Organization Settings — view platform and org voice server status, configure your own Mumble/TeamSpeak/Ventrilo server with ICE support for channel trees',
          'Join Server button — click to connect directly to the Mumble server from the Voice Servers page or Organization Settings',
          'Platform Voice Server — the Fringe Core federation Mumble server is now online at voice.fringecore.space with TLS encryption',
          'Channel tree display — see live channels and connected users when ICE is configured (populates when users connect)',
        ],
      },
      {
        category: 'improved',
        items: [
          'Voice Servers navigation icon — now shows a proper headset microphone icon instead of a generic fallback',
          'Reduced log noise — session binding mismatch warnings no longer flood production logs',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Image loading — Azure Blob Storage now uses Managed Identity authentication, fixing 403 errors on image downloads',
          'Mobile app download — the APK download link on the /mobile page now works correctly (was returning a "public access not permitted" error)',
        ],
      },
    ],
  },
  {
    version: '2026.05.209',
    date: '2026-05-22',
    title: 'Discord Dashboard UX Improvements',
    highlights: [
      'Personal notification preferences are now accessed by clicking your user chip in the guild header',
      'Advanced Event Settings are now part of the Events tab for a cleaner layout',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'My Preferences — your personal DM notification and timezone settings are now accessed by clicking the "You: Member" chip at the top of the Discord Dashboard, keeping personal settings separate from server admin tabs',
          'Events Tab — Advanced Event Settings (auto-lock, waitlist, duplicate RSVP prevention, signup deadline) are now shown inline at the bottom of the Events tab instead of a separate tab',
          'Access Control — Server Manager Roles now display the role name (e.g. @Moderator) instead of raw IDs when roles are loaded from Discord',
          'Cross-Org LFG — a helpful message now appears when no allied organizations are available, explaining how to set up diplomacy treaties or use manual RSI tag whitelisting',
        ],
      },
    ],
  },
  {
    version: '2026.05.208',
    date: '2026-05-22',
    title: 'Discord Ticket Visibility Fix',
    highlights: [
      'Tickets created from Discord now correctly save their category and appear in the web app Inbox',
      'The bot "My Tickets" list now accurately filters to your own tickets',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Tickets in Inbox — tickets created via the /ticket bot command or the helpdesk panel now appear in Inbox → Tickets on the web app. Previously they could be invisible if your Discord and platform accounts were not linked at the time of creation',
          'Ticket Categories — the category you select in Discord (HR, Recruitment, Diplomacy, General, Support) is now correctly saved on the ticket. Previously the Discord ID field was silently dropped during validation',
          'My Tickets (Bot) — the "My Tickets" button in Discord now shows only your own tickets instead of all visible tickets',
        ],
      },
    ],
  },
  {
    version: '2026.05.207',
    date: '2026-05-22',
    title: 'Moderation Kick Detection & Revoke Fix',
    highlights: [
      'Discord kicks are now reliably auto-detected and logged as moderation incidents',
      'The Revoke button in the bot moderation panel works again',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Kick Detection — Discord kicks were sometimes silently treated as voluntary leaves because the bot checked the audit log too quickly. Detection is now more resilient to Discord API latency so kicks are reliably captured',
          'Revoke Panel — the "Revoke" button and select menu in the /moderation bot panel always failed with "Incident not found". Revoking incidents from the bot panel now works correctly',
        ],
      },
      {
        category: 'improved',
        items: [
          'Duplicate Prevention — the same Discord kick can no longer accidentally create duplicate moderation incidents, even under high server load',
        ],
      },
    ],
  },
  {
    version: '2026.05.206',
    date: '2026-05-22',
    title: 'Discord Bot Reliability Fix',
    highlights: [
      'Fixed recruitment buttons returning "bot could not authenticate" errors',
      'Bot authentication is now more resilient against configuration issues',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Recruitment Buttons — "View Positions", "Quick Apply", and other recruitment panel buttons in Discord no longer fail with "The bot could not authenticate to the API" errors',
          "Bot Authentication — the bot's internal API calls can no longer be accidentally blocked by unrelated security middleware, making all Discord bot features more reliable",
        ],
      },
      {
        category: 'improved',
        items: [
          'Bot Security — the bot token comparison now uses a timing-safe algorithm to prevent brute-force attacks',
          'Diagnostics — administrators now see detailed logs when bot authentication fails, making configuration issues much easier to troubleshoot',
        ],
      },
    ],
  },
  {
    version: '2026.05.205',
    date: '2026-05-22',
    title: 'Announcement Channels & Auto-Publish',
    highlights: [
      'Discord announcement channels now appear in all channel pickers with a 📢 icon',
      'New auto-publish toggle automatically shares event announcements to all servers following the channel',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Announcement Channels — Discord announcement channels (📢) are now shown in all channel pickers alongside regular text channels, so you can route event announcements, notifications, and other messages to announcement channels directly',
          'Auto-Publish — enable "Auto-publish messages in announcement channels" in Discord Settings → Events and any event embed the bot posts to an announcement channel will be automatically published (crossposted) to every server following that channel',
        ],
      },
      {
        category: 'improved',
        items: [
          'Channel Pickers — channel type is now visually distinguished: # for text, 📢 for announcement, 🔊 for voice, 📁 for categories',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Notification Settings — saving notification settings with "Mention specific roles" disabled no longer shows a validation error',
        ],
      },
    ],
  },
  {
    version: '2026.05.204',
    date: '2026-05-21',
    title: 'Voice Server Monitoring & RSI Status Improvements',
    highlights: [
      'Connect your Mumble or TeamSpeak server and see live status, online users, and peak stats',
      'RSI Status panels now survive bot restarts',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Voice Servers — configure your org or federation Mumble/TeamSpeak server in settings and view live status, channel tree, and user activity',
          'Voice Server Stats — peak user tracking over 24h, 7d, and 30d with per-channel breakdown',
          'Platform Voice — federation members can access the shared platform Mumble server',
          'CAS Integration — external voice minutes now contribute to your Composite Activity Score',
        ],
      },
      {
        category: 'improved',
        items: [
          'RSI Status — deployed status panels now persist across bot restarts so you never miss an update',
        ],
      },
    ],
  },
  {
    version: '2026.05.203',
    date: '2026-05-21',
    title: 'Platform Security Update',
    highlights: [
      'We completed a comprehensive security review and patched everything — your data is safer and the platform is more reliable than ever',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Security — patched all known vulnerabilities across the platform; no action needed on your end',
          'Reliability — the database now automatically expands storage when needed, preventing potential outages',
          'Performance — scheduled maintenance now runs during low-traffic hours (Sunday early morning) to minimize any impact',
        ],
      },
    ],
  },
  {
    version: '2026.05.202',
    date: '2026-05-21',
    title: 'RSI Verification Reliability Improved',
    highlights: [
      'RSI handle verification and bio verification checks (token/code in bio) are now faster and more reliable — the system reads data directly from the RSI website instead of going through a third-party service that was timing out',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'RSI Verification — handle verification, bio verification checks (token/code in bio), and organization membership lookups are now significantly more reliable; the backend reads data directly from robertsspaceindustries.com instead of a third-party relay that was causing timeouts',
          'RSI Verification — if the RSI website is temporarily slow, recently fetched data is served from cache so verification still works',
        ],
      },
    ],
  },
  {
    version: '2026.05.201',
    date: '2026-05-21',
    title: 'Recruitment Panel: Closed State & Custom Text',
    highlights: [
      'The Discord recruitment panel now reflects your recruitment status — when recruitment is closed or paused on the web dashboard, the panel shows a grey "Recruitment Closed" embed with greyed-out buttons',
      'Admins can now customize the panel title and description before posting via a modal prompt',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Recruitment Panel — when recruitment is closed or paused on the web dashboard, the Discord panel embed now shows a grey "🔒 Recruitment Closed" state with all buttons disabled (greyed out)',
          'Recruitment Panel — clicking "Post Recruitment Panel" now opens a modal where you can customize the embed title and description before posting; leave fields blank to use the defaults from your web posting',
        ],
      },
    ],
  },
  {
    version: '2026.05.200',
    date: '2026-05-21',
    title: 'Recruitment Panel Fixed',
    highlights: [
      'The recruitment panel\'s "View Positions" and "Quick Apply" buttons now work correctly — positions load properly and applying no longer times out',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Recruitment Panel — "View Positions" no longer returns a server error; the endpoint now correctly scopes results to your organization instead of querying all organizations',
          'Recruitment Panel — "Quick Apply" no longer shows "This interaction failed"; the bot now defers its response before fetching data, then presents apply buttons so you can click to open the application form',
        ],
      },
    ],
  },
  {
    version: '2026.05.199',
    date: '2026-05-21',
    title: 'RSI Verification Redesigned',
    highlights: [
      'The RSI verification panel has been split into a clean user-facing /verify command and a separate /rsisync admin command — linking your RSI account is now simpler with generated verification link/token guidance and inline verification checks',
      'RSI verification now syncs between the web app and Discord bot — verify in one place and it shows everywhere',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'RSI Verification — the /verify panel now focuses on linking, unlinking, and checking your RSI handle with a streamlined 3-button layout',
          'RSI Verification — after linking your RSI handle, you now get generated verification link/token instructions, a direct link to your RSI profile, and a Check Verification button for immediate inline verification',
          'RSI Verification — verifying your RSI account on either the web app or Discord bot now syncs to both systems automatically',
          'RSI Sync — admin sync features (Sync Status, Setup Wizard, Run Sync, Audit) moved to the new /rsisync command for cleaner separation',
        ],
      },
      {
        category: 'fixed',
        items: [
          'RSI Verification — the "My Verification" button in Discord now correctly shows your verification status (was always showing "unverified" due to a field name mismatch)',
        ],
      },
      {
        category: 'removed',
        items: [
          'RSI Verification — the "Templates" button has been removed from the verification panel',
        ],
      },
    ],
  },
  {
    version: '2026.05.198',
    date: '2026-05-21',
    title: 'Support Tickets Now Visible',
    highlights: [
      'Support tickets created from Discord or the web app are now visible in the Ticket Management page — organization owners, admins, and officers can see all tickets routed to their role',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Tickets — tickets created via the Discord helpdesk panel (HR, Recruitment, Diplomacy, General, Technical Support) now appear in your Inbox → Tickets page; previously all role-based tickets were invisible because the visibility filter did not account for organizational roles',
          'Tickets — organization owners, admins, and founders now see all tickets across the organization instead of only tickets they personally created or were assigned to',
          'Tickets — officers now see tickets routed to their functional departments (HR, Recruitment, Diplomacy, Officers) in addition to their own tickets',
        ],
      },
    ],
  },
  {
    version: '2026.05.197',
    date: '2026-05-21',
    title: 'Federation Voice Channels Fix',
    highlights: [
      'Temporary voice channels now work correctly in federation-linked Discord servers — joining a hub channel in a federation Discord now creates a personal voice channel as expected',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Bot — temporary voice channel creation (join-to-create) now works in federation-only Discord servers; previously voice settings configured via the federation were ignored when no organization was linked to the same server',
        ],
      },
    ],
  },
  {
    version: '2026.05.196',
    date: '2026-05-21',
    title: 'Discord Settings Now Load Saved Values',
    highlights: [
      'Discord Settings tabs now correctly display your saved configuration when you open the page — previously all fields appeared empty or at their defaults even though the settings were saved',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Settings — all tabs (Voice Channels, Events, Team Voice, Recruitment, Notifications, DM Notifications, and more) now properly load and display your saved configuration instead of showing empty or default values',
        ],
      },
    ],
  },
  {
    version: '2026.05.195',
    date: '2026-05-21',
    title: 'Discord /analytics Permission Fix',
    highlights: [
      'The /analytics bot command now works for all server admins — it no longer requires platform administrator privileges',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Bot — the /analytics command no longer requires platform admin; any member with Manage Server permission can now view bot usage stats (command counts, success rate, uptime)',
        ],
      },
    ],
  },
  {
    version: '2026.05.194',
    date: '2026-05-20',
    title: 'Discord Ticket Creation Fix',
    highlights: [
      'Creating tickets from the Discord /ticket panel and /diplomacy command now works — previously every attempt failed with a validation error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Bot — creating a ticket via the /ticket panel no longer fails with "Validation error"; the bot now correctly routes tickets to the appropriate recipient based on category (HR → HR Department, Recruitment → Recruitment, Diplomacy → Diplomacy, General/Support → Org Leadership)',
          'Discord Bot — creating a diplomacy ticket via the /diplomacy command no longer fails with a validation error',
        ],
      },
    ],
  },
  {
    version: '2026.05.193',
    date: '2026-05-19',
    title: 'Team Emblem Persistence & Display Fix',
    highlights: [
      'Team emblems now save and display reliably — uploaded logos no longer disappear after creating or editing a team',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Teams — uploaded emblems now persist correctly when creating or editing a team; previously the logo could silently fail to save',
          'Dashboard — Teams & Squads widget now properly displays team emblems instead of showing fallback letter avatars',
          'Teams — clearing a team emblem via the edit dialog now works as expected',
        ],
      },
    ],
  },
  {
    version: '2026.05.192',
    date: '2026-05-19',
    title: 'Pending Applications & Invites on Members Page',
    highlights: [
      'Organization leaders can now review pending applications and sent invitations directly from the Members & Roles page',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Members & Roles — pending applications panel now appears below the member table so admins can accept or reject applicants without leaving the page',
          'Members & Roles — sent invitations panel shows all outstanding invites with status filters and approve/reject actions',
        ],
      },
    ],
  },
  {
    version: '2026.05.191',
    date: '2026-05-19',
    title: 'LFG Upgrades & Discord Settings',
    highlights: [
      'LFG posts now ping the configured mention role so players get notified',
      'New guild settings for stat tracking, giveaways, DM notifications, and advanced events',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LFG — new posts now ping the configured LFG role to alert interested players',
          'LFG — voice channel hosts get mute, deafen, and disconnect controls',
          'LFG — `/lfg settings` shows current LFG configuration at a glance',
          'Discord Settings — new tabs for member stat tracking, giveaway defaults, DM notification events, and advanced event settings (lock-when-full, bench/waitlist, signup deadlines)',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Bot — verify command no longer returns 401 errors',
          'Bot — federation commands work correctly when guild context is unavailable',
          'Discord Settings — fixed multiple UI errors in new settings tabs',
        ],
      },
    ],
  },
  {
    version: '2026.05.190',
    date: '2026-05-19',
    title: 'Tunnel Timeouts & Discord Resilience',
    highlights: [
      'Jump point tunnel list no longer times out when Discord is slow',
      'Discord guild lookups fall back to REST API when the bot gateway is disconnected',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Tunnels — the tunnel list page now loads within 10 seconds even when Discord API is slow, showing tunnel data without guild names as a fallback',
          'Discord — guild name resolution falls back to the REST API when the bot gateway is not connected',
          'Bot Invite — the invite URL now uses the correct backend address in all environments',
        ],
      },
    ],
  },
  {
    version: '2026.05.184',
    date: '2026-05-18',
    title: 'Bot Auth Fix, LFG Cleanup & Diplomacy',
    highlights: [
      'Discord bot commands (tickets, recruitment, helpdesk, diplomacy) now authenticate correctly — no more "Access token required" errors',
      'LFG posts and voice channels are cleaned up immediately when closed, expired, or emptied',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Bot Authentication — resolved the root cause of "Access token required" errors on ticket, recruitment, helpdesk, and diplomacy bot commands',
          'Diplomacy — the /diplomacy command now uses the correct v2 API endpoints for proposals, incidents, and status',
          'LFG Cleanup — closing an LFG post now immediately removes the Discord message (after 5s) and deletes the voice channel',
          'LFG Empty Channel — when an LFG voice channel empties out, both the post and channel are removed right away',
        ],
      },
    ],
  },
  {
    version: '2026.05.183',
    date: '2026-05-18',
    title: 'Federation Discord Support — Voice, Events, Polls & Settings',
    highlights: [
      'Federation central Discord servers now support all major bot commands — no org link required',
      'New Guild Feature Settings panel on the Federation Manage page for voice, events, moderation, and notifications',
    ],
    changes: [
      {
        category: 'added',
        items: [
          "Federation Voice Hubs — set up join-to-create voice channels directly on your federation's central Discord server via /voice → Hub Setup",
          'Federation Guild Settings UI — configure voice, events, moderation, and notification settings from the Federation Manage page → Discord tab',
          'Federation Bot Commands — /events, /schedule, /poll, /bounty, /readycheck, /verify, and /attend now work on federation central servers',
        ],
      },
      {
        category: 'improved',
        items: [
          "Bot error messages now mention /federation setup as an option when a server isn't linked",
          "Voice auto-create checks federation settings when org settings aren't available",
        ],
      },
    ],
  },
  {
    version: '2026.05.182',
    date: '2026-05-18',
    title: 'LFG Improvements — Smart Expiry, Mention Role & Voice Controls',
    highlights: [
      'LFG posts now auto-close when the voice channel empties and extend when players are still active',
      'Admins can set a mention role so the right people get pinged when new LFG posts are created',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LFG Mention Role — admins can configure a Discord role to @mention when new LFG posts are created (via /notify → LFG Mention Role)',
          'LFG Voice Controls — auto-created LFG voice channels now show Lock, Rename, Trust, Kick and other channel controls just like regular temp channels',
          'LFG Smart Expiry — if your voice channel still has players when the timer runs out, the post gets 50% extra time automatically',
        ],
      },
      {
        category: 'fixed',
        items: [
          'LFG Expired Posts — clicking buttons on an expired LFG post now shows a clear "session expired" message instead of a confusing error',
          'LFG Empty Channel Cleanup — LFG posts auto-close when their voice channel has been empty for 5 minutes',
        ],
      },
    ],
  },
  {
    version: '2026.05.181',
    date: '2026-05-18',
    title: 'Bot Integration & RSI Sync Fixes',
    highlights: [
      'Discord bot commands for RSI verification status now use the correct API endpoint',
      'RSI role mapping API now supports bot authentication for seamless Discord integration',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'RSI Verify — the /verify status bot command now correctly fetches role mappings via the v2 API',
          'RSI Role Mapping — Discord bot can now authenticate to the role mapping endpoint (previously bot calls were rejected)',
          'Bot Auth Diagnostics — improved logging helps trace authentication issues between the Discord bot and backend API',
        ],
      },
    ],
  },
  {
    version: '2026.05.180',
    date: '2026-05-18',
    title: 'Security Hardening & Code Quality Fixes',
    highlights: [
      'Fleet visibility access checks now verify your real security level server-side — no more client-side overrides',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fleet Visibility — access level checks now use your actual org membership rank instead of trusting client-provided values',
          'Fleet Visibility & Treaty Template API routes aligned to the standard /api/v2/ prefix',
          'System Map — selection and location colors extracted into named constants for consistency',
          'Discord Settings — brand colors now reference the shared palette instead of duplicating values',
        ],
      },
    ],
  },

  {
    version: '2026.05.178',
    date: '2026-05-18',
    title: 'Federation Discord Settings',
    highlights: [
      'Federations can now configure Discord bot features at the federation level — events, voice channels, tickets, recruitment, and 16 more setting modules',
      'Discord bot features respect federation-level overrides when no org-level config exists',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Federation Discord guild settings — configure bot features (events, voice, tunnels, notifications, role sync, moderation, tickets, stats, DM notifications, LFG, recruitment, giveaways, welcome messages, and more) at the federation level',
          'Federation settings fallback — Discord bot checks federation settings when an org has no guild-level config, so federation-wide defaults apply automatically',
          'Per-section settings updates — ambassadors with settings permission can update each Discord feature module independently',
        ],
      },
    ],
  },

  {
    version: '2026.05.176',
    date: '2026-05-17',
    title: 'Voice Channel Permission Inheritance',
    highlights: [
      "Temporary voice channels created via join-to-create hubs now inherit the hub's permission settings, so role-based visibility and access carry over automatically",
    ],
    changes: [
      {
        category: 'improved',
        items: [
          "Voice Channels — Auto-created temp channels now inherit the hub channel's permission overwrites instead of starting with a blank set",
          'Voice Channels — Channel creators now receive explicit Connect, Speak, and Stream permissions in addition to management permissions, ensuring they can always use their own channel',
          'Voice Channels — Ownership transfer now grants the full permission set (including Connect, Speak, Stream) to the new owner',
        ],
      },
    ],
  },
  {
    version: '2026.05.175',
    date: '2026-05-17',
    title: 'Discord Bot Recruitment & Diplomacy Fixes',
    highlights: [
      'Recruitment commands from the Discord bot (list, view, apply, accept/deny applications) now work correctly — the bot was being rejected by an authentication layer that only accepted browser logins',
      'Diplomacy ticket creation from the Discord bot panel now reaches the correct API endpoint',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Recruitment — All /recruitment bot commands (list, view, apply, accept, deny, my applications) now authenticate correctly; previously returning "Access token required" errors',
          'Accept/Deny Buttons — Recruitment application accept and deny buttons now call the correct API route; previously these would silently fail because the URL pattern was wrong',
          'Diplomacy Tickets — Creating a diplomacy support ticket via the Discord bot panel now works; the bot was calling an outdated API path',
        ],
      },
    ],
  },

  {
    version: '2026.05.173',
    date: '2026-05-17',
    title: 'Discord Bot Ticket & Recruitment Commands Work Again',
    highlights: [
      'Creating tickets and browsing recruitment posts from the Discord bot now works reliably — the bot was accidentally calling an outdated API endpoint that no longer accepts requests',
      'If you previously saw "Access token required" or "Direct access not permitted" when clicking a ticket or recruitment button in Discord, this update resolves the issue',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Ticket Creation — Clicking a ticket category on the /ticket panel in Discord no longer returns a "401" or "Direct access not permitted" error; the bot\'s internal authentication is now correctly recognized by the ticket API',
          'Discord Recruitment Commands — All /recruitment actions (list, view, apply, accept, deny, my applications) now reach the correct API; previously these commands silently failed or returned errors because the bot was calling a retired endpoint',
          'Recruitment Redirect — The "Recruitment" button on the /ticket panel now opens the correct recruitment page instead of returning an error',
        ],
      },
    ],
  },
  {
    version: '2026.05.172',
    date: '2026-05-19',
    title: 'Multi-Crew Ships Now Show the Correct Number of Crew Slots',
    highlights: [
      'Ships like the Constellation Andromeda, Carrack, Polaris, Hammerhead, and other multi-crew vessels now display the full crew complement in events and activities — no more being capped at a single pilot slot',
      'The fix applies retroactively: existing events and activities have been updated automatically; you do not need to remove and re-add ships for the correct slot counts to appear',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Crew Slots in Events — Activity rosters, ship cards, and the totals derived from them now expose every crew seat a ship is rated for (e.g. an Andromeda shows 5 slots instead of 1), so members can join positions like turret gunner, engineer, and co-pilot without the slot disappearing',
          'Ship Catalogue Crew Counts — Backfilled the maximum crew complement on 59 ships in our catalogue from the authoritative Star Citizen ship matrix so the numbers match in-game expectations',
          'Historical Events Repaired — A one-off data fix corrected previously-saved activity snapshots that captured the wrong slot count, so older events display correctly when reopened',
        ],
      },
    ],
  },
  {
    version: '2026.05.171',
    date: '2026-05-18',
    title: 'Discord Messages Render With Proper Punctuation Again',
    highlights: [
      'Apostrophes, quotation marks, ampersands, and angle brackets now appear correctly in every Discord embed, DM, ticket transcript, poll, LFG post, voice channel name, and announcement — no more raw &#x27; or &amp; codes leaking through',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Display — Embeds, DMs, ticket transcripts, poll questions, LFG listings, voice channel names, announcement messages, reaction-role panels, and giveaway titles no longer show HTML entity codes (such as `&#x27;`, `&quot;`, `&amp;`, `&lt;`, `&gt;`) instead of the original characters; stored text is now decoded at every render boundary before being sent to Discord',
          'Existing Content — The fix applies automatically to all previously-saved text; you do not need to re-edit names, titles, or descriptions for them to render correctly',
        ],
      },
    ],
  },
  {
    version: '2026.05.170',
    date: '2026-05-18',
    title: 'Cleaner Path to Your Member Roster',
    highlights: [
      'Opening "User Management" from the command palette or an old bookmark now lands you on Members & Permissions instead of a broken page',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'User Management Link — The legacy `/users` page (which previously failed to load any data) now redirects straight to Members & Permissions in Org Settings, so the command-palette entry and any saved bookmarks work the way you would expect',
        ],
      },
    ],
  },
  {
    version: '2026.05.169',
    date: '2026-05-18',
    title: 'Ship Assignments Over the API Are Now Audited',
    highlights: [
      "Adding or removing ships from a fleet through our GraphQL API now persists like the web app does and shows up in your organization's audit log",
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Fleet Ship Membership API — Adding or removing a ship from a fleet via the GraphQL API now goes through the same service path as the web UI: tenant ownership of the ship is enforced, duplicate assignments are rejected with a clear conflict error, the fleet team is auto-provisioned on first ship, slot capacity is resynced, and the change is captured in your organization audit log',
          'Fleet API Errors — Ship-membership endpoints now return typed error codes (`NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`) instead of a generic failure',
        ],
      },
    ],
  },
  {
    version: '2026.05.168',
    date: '2026-05-18',
    title: 'Fleet Changes Always Audited — Even Over the API',
    highlights: [
      'Creating, updating, or deleting a fleet through our GraphQL API now produces the same audit-log trail as doing it from the web app, so admins always see a complete history',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Fleet Audit Trail — Fleet create / update / delete actions performed through the GraphQL API now go through the same service path as the web UI, so every change is captured in the organization audit log with the actor, timestamp, and field-level diff',
          'Fleet API Errors — Validation and conflict errors from the GraphQL fleet endpoints now return clear, typed error codes (`VALIDATION_ERROR`, `CONFLICT`, `NOT_FOUND`) instead of a generic failure',
        ],
      },
    ],
  },
  {
    version: '2026.05.167',
    date: '2026-05-18',
    title: 'Help Center Expanded — Session & Sign-In Security',
    highlights: [
      'New Help Center entries explain how Fringe Core keeps your sign-in secure, where your login token is actually stored, and what to try if your session ever feels unreliable',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'FAQ — “How does Fringe Core keep my sign-in secure?” covers HttpOnly cookies, CSRF protection, refresh-token rotation, and what happens when a stolen token is replayed',
          'FAQ — “My session keeps dropping or sign-in feels unreliable — what changed?” explains the unified API client (consistent retries, timeouts, and silent expected-not-signed-in handling) and how to recover with a hard refresh',
          'FAQ — “Where is my login token stored? Can a browser extension or malicious script steal it?” details HttpOnly + Secure + SameSite=Lax cookie protection and confirms we never store auth tokens in localStorage or sessionStorage',
        ],
      },
    ],
  },
  {
    version: '2026.05.164',
    date: '2026-05-16',
    title: 'Platform Security & Reliability Hardening',
    highlights: [
      'Stronger production safeguards across our database, API surface, and container infrastructure',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Database Network Safety — Our managed PostgreSQL is now closed to the public internet by default; access is now an explicit opt-in per environment to prevent accidental exposure',
          'API Documentation Safety — The interactive API docs (Swagger UI) now refuse to start in production unless explicitly enabled, eliminating accidental exposure of internal endpoints',
          'Production Health Monitoring — Every production container (backend, worker, bot, frontend) now reports its health to the orchestrator so unhealthy services are restarted automatically',
        ],
      },
    ],
  },
  {
    version: '2026.05.162',
    date: '2026-05-16',
    title: 'Stronger Sign-In Security',
    highlights: [
      'Your sign-in tokens are no longer stored in the browser — they live in secure, HttpOnly cookies that JavaScript cannot read',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Token Security — Access tokens are now delivered exclusively as HttpOnly cookies, making them immune to exfiltration via cross-site scripting (XSS). Refresh tokens already used this protection; access tokens have now caught up',
          'Session Storage — The app no longer persists any authentication token to your browser\u2019s local storage. Only your profile and signed-in flag are kept locally, so signing out or clearing cookies fully invalidates your session',
        ],
      },
    ],
  },
  {
    version: '2026.05.160',
    date: '2026-05-16',
    title: 'Reliability & Security Hardening',
    highlights: [
      'Fleet data now loads correctly through the new GraphQL API',
      'Federation and alliance operations now return clearer, more specific error messages',
      'The platform now refuses to start in production if security configuration is missing or invalid',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Fleet List (GraphQL) — Fetching fleets through the GraphQL endpoint now returns real data with proper pagination instead of an empty list',
          'Federation & Alliances — Errors when creating, joining, or managing federations now show meaningful messages (e.g. "not found", "already a member", "forbidden") instead of a generic failure',
          'Platform Stability — Backend safeguards now prevent the server from starting in production with missing or invalid security settings, reducing the risk of misconfigured deployments',
        ],
      },
    ],
  },
  {
    version: '2026.05.132',
    date: '2026-05-12',
    title: 'Discord Bot — Improved Reliability',
    highlights: [
      'The Discord bot now detects when it is added to or removed from a server even if it is temporarily offline, thanks to a new webhook-based backup sync',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Discord Bot — If the bot is restarting or briefly offline when it is added to or removed from your server, the platform now catches up automatically via Discord webhook events so your server settings stay in sync',
          'Discord Bot — Added audit logging for bot authorization and deauthorization events for better visibility into server connections',
        ],
      },
    ],
  },
  {
    version: '2026.05.131',
    date: '2026-05-12',
    title: 'Mobile App — SSO, Passkeys & Fringe Core Branding',
    highlights: [
      'Sign in to the mobile app with Discord, Google, or Twitch — the same SSO providers as the web app',
      'Passkey (fingerprint/face) login is now available on mobile devices',
      'The mobile app has been rebranded to "Fringe Core" with the full dark theme and logo',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Mobile App — Sign in with Discord, Google, or Twitch using the same accounts as the web platform',
          'Mobile App — Passkey (biometric) login support — sign in with your fingerprint or face via a secure in-app browser flow',
          'Mobile App — Fringe Core dark theme with cyan and purple accent colors matching the web design',
          'Mobile App — Fringe Core logo on login and registration screens',
        ],
      },
      {
        category: 'improved',
        items: [
          'Mobile App — Redesigned login screen with SSO buttons, passkey option, and credential form',
          'Mobile App — Dark navigation theme throughout the app with branded tab bar',
          'Mobile App — Renamed from "SC Fleet Manager" to "Fringe Core"',
        ],
      },
    ],
  },
  {
    version: '2026.05.130',
    date: '2026-05-12',
    title: 'Security Patch — Monitoring Stability Fix',
    highlights: [
      'Patched a dependency vulnerability that could allow a single malformed network request to crash the monitoring service, improving overall platform stability',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Resolved a vulnerability in the telemetry monitoring stack where a malformed request could cause an unexpected service interruption — the system now gracefully rejects invalid requests instead',
        ],
      },
    ],
  },
  {
    version: '2026.05.129',
    date: '2026-05-12',
    title: 'Interdiction Planner — Better Instructions & Visual Distances',
    highlights: [
      'The Interdiction Planner now shows perpendicular distance lines from the QED-Snare to each quantum route, so you can see exactly how far each route passes from the snare',
      'A new collapsible guide explains quantum interdiction mechanics, step-by-step usage, and tactical tips',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Interdiction Planner — Dashed perpendicular lines now connect the snare position to each quantum route, color-coded green (within range) or red (out of range)',
          'Interdiction Planner — Distance labels on each perpendicular line show the exact distance from the snare to the route',
          'Interdiction Planner — Inner range rings at 25%, 50%, and 75% of QED radius help you judge how close routes pass to the snare center',
          'Interdiction Planner — A "QED {range}" label above the outer range circle makes the effective range immediately visible',
          'Interdiction Planner — New collapsible "How Quantum Interdiction Works" section on the page covers quantum travel mechanics, step-by-step instructions, results interpretation, and tactical placement tips',
        ],
      },
    ],
  },
  {
    version: '2026.05.128',
    date: '2026-05-12',
    title: 'Fleet Visibility Controls & Treaty Agreement Templates',
    highlights: [
      'Fleet visibility rules let you control who sees each fleet — by member rank, allied organization, or federation membership — with three detail levels (summary, composition, full)',
      'Six built-in treaty templates (Mutual Defense, Trade, Non-Aggression, and more) plus the ability to create your own custom templates with required and optional clauses',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Fleet Management — New Visibility Rules panel on each fleet lets you create rules controlling who can see the fleet and at what detail level (summary, composition, or full)',
          'Fleet Visibility — Organization scope: restrict fleet viewing to members with a minimum rank (security level). Only members meeting the threshold see the fleet',
          'Fleet Visibility — Alliance scope: share fleet details with a specific allied organization. Requires an active diplomacy treaty between the two orgs',
          'Fleet Visibility — Federation scope: share fleet details with all member organizations of a federation you belong to',
          'Fleet Visibility — Access check endpoint lets you verify what level of visibility a requesting org has to your fleet before sharing',
          'Treaty Templates — Six built-in agreement templates ready to use: Standard Mutual Defense Pact, Trade Agreement, Non-Aggression Pact, Resource Sharing Agreement, Intel Sharing Agreement, and Military Cooperation Agreement',
          'Treaty Templates — Create custom templates with your own clauses. Mark clauses as required (cannot be removed when using the template) or optional',
          'Treaty Templates — Instantiate a template to generate treaty terms for your alliance or federation. Override clause text, exclude optional clauses, or add custom ones',
          'Treaty Templates — Version tracking: template version increments automatically when clauses are updated, so you can track changes over time',
          'Treaty Templates — Scope filtering: templates can be scoped to alliance-only, federation-only, or both contexts',
        ],
      },
      {
        category: 'improved',
        items: [
          'Fleet sharing now supports granular access levels instead of simple on/off — choose between summary (name and ship count), composition (breakdown by role and manufacturer), or full (complete fleet details)',
          'Alliance and federation integrations validate that relationships are active before allowing visibility rules to be created',
        ],
      },
    ],
  },
  {
    version: '2026.05.128',
    date: '2026-05-12',
    title: 'Dashboard Quick Actions Restructured',
    highlights: [
      'The dashboard now groups shortcuts into three sections — Quick Actions for operations, Community for people management, and Management for admin tools',
      'Each section can be hidden, collapsed, or reordered independently from the Customize panel',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Dashboard — Quick Actions now focuses on core operations: Tactical Calendar, Fleet Management, Logistics, and Trading',
          'Dashboard — New Community section groups Members & Roles, Teams & Squads, Recruitment, and Organizations together',
          'Dashboard — Management section remains for Org Settings, Discord Dashboard, and Admin Dashboard',
          'Dashboard — All three sections are independently collapsible, hideable, and reorderable via the Customize panel',
        ],
      },
    ],
  },
  {
    version: '2026.05.127',
    date: '2026-05-12',
    title: 'Smarter Cross-Org LFG with Diplomacy & RSI Tags',
    highlights: [
      'Cross-org LFG now pulls from your active diplomacy treaties, federation memberships, and allied relationships — all in one picker',
      'Manually whitelist or block organizations by their RSI spectrum tag for fine-grained control',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Discord Settings → LFG — Active diplomacy treaties (trade, military, mutual defense, non-aggression, full alliance) now appear as selectable organizations in the cross-org LFG picker under "Diplomacy Treaties"',
          'Discord Settings → LFG — New "Blocked Organizations" dropdown to explicitly exclude specific orgs from LFG sharing, even if they have an active treaty or federation membership',
          'Discord Settings → LFG — Manual RSI Tag Whitelist — type an RSI spectrum tag (e.g. FRINAUTS) to allow LFG from an organization not yet in your diplomacy or federation lists',
          'Discord Settings → LFG — Manual RSI Tag Block List — block organizations by RSI tag; blocked tags override all allow rules',
          'Conflict warning shown when the same organization or RSI tag appears in both the allow and block lists',
        ],
      },
      {
        category: 'improved',
        items: [
          'Cross-org LFG picker now groups options into three categories: Diplomacy Treaties, Federations, and Allied Organizations',
          'Informational banner explains where the org list comes from and how to use manual RSI tags',
        ],
      },
    ],
  },
  {
    version: '2026.05.126',
    date: '2026-05-12',
    title: 'Mobile App & Changelog on Landing Page',
    highlights: [
      'The mobile companion app download is now featured on the landing page and dashboard — no login required to find it',
      'Latest release notes are now prominently shown on the landing page so you never miss an update',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Landing page — new Mobile Companion section with download button, feature list, and platform badges',
          "Landing page — new What's New section showing the 3 most recent changelog entries with highlights and category chips",
          'Dashboard — Mobile App quick action added to the shortcuts panel for both org and solo users',
        ],
      },
      {
        category: 'improved',
        items: [
          'Mobile App download — now accessible at /mobile without requiring authentication',
          'Navigation — mobile app link in command palette and sidebar now points to the public page',
        ],
      },
      {
        category: 'removed',
        items: [
          'Removed the authenticated-only /mobile-app page — the public /mobile page has the same content and is easier to share',
        ],
      },
    ],
  },
  {
    version: '2026.05.125',
    date: '2026-05-12',
    title: 'Discord Bot Command References Updated',
    highlights: [
      'All slash command references across the platform now reflect the current panel-based bot architecture — no more outdated /command subcommand syntax',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Landing page — removed non-existent /fleet list command and corrected slash command count to 32',
          'Discord Settings — LFG tips now show actual panel buttons (Browse Groups, Create Group, Find Match, etc.) instead of old /lfg subcommands',
          'Discord Settings — Commlink tips now show panel buttons (List, Create, Join, Link by Code, etc.) instead of old /commlink subcommands',
          'FAQ — "What commands are available?" answer now lists all 32 registered slash commands',
          'FAQ — event, LFG, and recruitment command references updated to use panel button navigation',
        ],
      },
      {
        category: 'improved',
        items: [
          'Landing page hero section — updated command showcase with accurate descriptions matching the live bot',
          'Feature showcase — corrected Discord Integration description to "32 commands across 8 domains"',
        ],
      },
    ],
  },
  {
    version: '2026.05.124',
    date: '2026-05-11',
    title: 'Discord Settings & Voice Channel Fixes',
    highlights: [
      'Discord integration settings now persist reliably — changes no longer silently disappear when switching tabs or refreshing the page',
      'Temporary voice channels now create correctly after configuring the hub channel from the web dashboard',
      'Allied blacklist incidents can now be auto-enforced (timeouts & kicks) — bans always require manual confirmation',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          "Discord Settings — saving one tab no longer resets unsaved changes on other tabs. Each tab's form state is now preserved independently until you explicitly click Refresh",
          'Discord Settings — clearing a channel or role picker and saving now correctly removes the value instead of silently keeping the old one',
          'Temporary voice channels — the "Hub Channel" selection is now properly saved to the database, so the bot correctly detects when members join the hub and creates their personal channel',
        ],
      },
      {
        category: 'added',
        items: [
          'Blacklist Auto-Enforce — allied timeout and kick actions can now be automatically applied to your server. Enable it via /blacklist settings or the Moderation tab in Discord Settings. Bans are never auto-enforced',
        ],
      },
      {
        category: 'improved',
        items: [
          'Voice auto-create logging — clearer warnings when no hub channel is configured despite the feature being enabled, making troubleshooting easier',
        ],
      },
    ],
  },
  {
    version: '2026.05.123',
    date: '2026-05-11',
    title: 'Mobile App Build Stability',
    highlights: [
      'The Android APK now builds reliably on Expo SDK 55 — download the latest version from Help → Mobile App',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Mobile app build — resolved dependency alignment and Kotlin compilation issues that prevented the Android APK from building successfully',
          'Mobile app build — fixed monorepo duplicate dependency conflicts between the web and mobile apps',
        ],
      },
      {
        category: 'improved',
        items: [
          'Mobile app — upgraded to Expo SDK 55 with all dependencies aligned to their recommended versions for better stability and performance',
        ],
      },
    ],
  },
  {
    version: '2026.05.122',
    date: '2026-05-11',
    title: 'Dashboard Layout Upgrade & Customizable Quick Actions',
    highlights: [
      'Organization Insights and Activity Analytics now sit side by side for a clearer at-a-glance view',
      'Quick Action buttons are now customizable — choose which shortcuts appear on your dashboard',
      'Teams & Squads on the dashboard now show team emblems instead of generic icons',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Customizable Quick Actions — click the pencil icon on the Quick Actions widget to choose which shortcut buttons appear. Your selection is saved per account and persists across sessions',
        ],
      },
      {
        category: 'improved',
        items: [
          'Dashboard layout — Organization Insights and Activity Analytics are now displayed side by side on desktop screens, giving you a combined overview without scrolling',
          'Dashboard layout — Pending Approvals and Management widgets are now paired side by side for a more balanced grid',
          'Teams & Squads widget — teams with a custom emblem now display the emblem image on their card instead of the default group icon',
          'Quick Action cards now use a native button element for improved keyboard navigation and screen reader accessibility',
        ],
      },
    ],
  },
  {
    version: '2026.05.121',
    date: '2026-05-11',
    title: 'Mobile App Download Page',
    highlights: [
      'Download the Fringe Core mobile app directly from your dashboard — look for "Mobile App" in the Help section',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Mobile App download page — logged-in users can now download the Android APK from the Help hub without leaving the site',
          'Step-by-step installation guide and sideloading instructions included on the download page',
          'iOS placeholder with "Coming Soon" badge',
        ],
      },
    ],
  },
  {
    version: '2026.05.120',
    date: '2026-05-11',
    title: 'RSI Organization Name Fix',
    highlights: [
      'Pull Name from RSI now correctly fetches the full organization name instead of just the tag',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'RSI organization sync — "Pull Name from RSI" now returns the full name (e.g. "Fringenauts Inc.") instead of the short tag (e.g. "FRINAUTS")',
        ],
      },
    ],
  },
  {
    version: '2026.05.119',
    date: '2026-05-10',
    title: 'Mobile App — Fleet Management On the Go',
    highlights: [
      'A new React Native mobile app for iOS and Android brings Fringe Core to your pocket',
      'View fleet stats, browse members, read notifications, and chat — all from your phone',
      'Real-time updates via Socket.io keep mobile and web in sync',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Mobile app (iOS & Android) — five-tab navigation with Fleet, Members, Chat, Notifications, and Profile',
          'Fleet tab — view fleet statistics (ships, members, fleet count), browse fleets, and drill into fleet details with ship lists',
          'Members tab — browse organization members with pull-to-refresh and drill into member profiles showing RSI handle and ships',
          'Chat tab — real-time messaging via Socket.io with message history and keyboard handling',
          'Notifications tab — view alerts with unread indicators, mark-as-read on tap, and 30-second auto-refresh',
          'Profile tab — view your profile, RSI info, organization memberships, and log out. Settings screen shows account details',
          'Ship detail screen — view ship specs including manufacturer, model, role, size, status, and condition',
          'Pull-to-refresh on all list screens for instant data reload',
          'Loading states (spinner) and empty states on every screen',
        ],
      },
    ],
  },
  {
    version: '2026.05.118',
    date: '2026-05-10',
    title: 'Discord Ready Check Command',
    highlights: [
      'Start and respond to ready checks directly from Discord with the new /readycheck slash command',
      'Five actions in one panel — Start, Ready, Not Ready, Status, and Cancel — all from Discord',
      'Ready checks sync in real time between the web app and Discord',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Discord /readycheck command — type /readycheck to open a panel with Start, Ready, Not Ready, Status, and Cancel buttons. Select an activity, optionally set the duration (30s–10min), and the ready check is live',
          'Respond to ready checks from Discord — participants can mark themselves Ready or Not Ready without opening the web app',
          'Ready check status embed — view a live summary of who has responded, with a countdown timer showing when the check expires',
        ],
      },
    ],
  },
  {
    version: '2026.05.117',
    date: '2026-05-10',
    title: 'Dashboard Redesign — Grid Layout & Widget Reordering',
    highlights: [
      'Dashboard now uses a responsive 2-column grid — compact widgets sit side-by-side on desktop, reducing scrolling by ~30%',
      'You can now drag-and-drop widgets to rearrange your dashboard — open Customize and drag or use the arrow buttons',
      'Live Activity Feed and LFG Feed now display side-by-side on wider screens for a more efficient overview',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Dashboard widget reordering — open the Customize panel (gear icon) and drag widgets by the grip handle or use the up/down arrow buttons to set your preferred order. Your layout is saved automatically and persists across sessions',
        ],
      },
      {
        category: 'improved',
        items: [
          'Dashboard layout upgraded to a responsive 2-column grid — Organization Alerts pairs with Pending Approvals, Management pairs with Activity Analytics, and Live Feed pairs with LFG Activity on medium+ screens',
          'Widget cards now stretch to equal height when side-by-side, so paired widgets are visually aligned',
          'Live Activity Feed height reduced from 600px to 400px when displayed in the grid layout — still shows 8+ events with scrolling',
          'LFG Activity widget now scrolls within its card when paired alongside the Live Feed, keeping both feeds visible at once',
        ],
      },
    ],
  },
  {
    version: '2026.05.116',
    date: '2026-05-10',
    title: 'Team Emblems, Badge Icons & Image Previews Fixed',
    highlights: [
      'Team emblems now save and display correctly — previously, uploaded emblems disappeared after saving',
      'Badge icons can now be cleared once set — the delete button on badge icons works properly',
      'Alliance banner and logo previews no longer show broken image icons when an image fails to load',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Team emblems now persist after saving — uploaded or URL-based emblems are correctly returned from the server and displayed on team cards and in the edit dialog',
          'Badge icons can now be removed after being set — clicking the delete icon on a badge properly clears it on save',
          'Alliance banner and logo previews gracefully handle broken or missing images instead of showing a broken image icon — previews automatically recover when a new URL is entered or a new image is uploaded',
        ],
      },
    ],
  },
  {
    version: '2026.05.115',
    date: '2026-05-10',
    title: 'Email Delivery Upgraded & Bot Log Noise Reduced',
    highlights: [
      'Email notifications (password resets, magic links, org deletion confirmations) now use Azure Communication Services for more reliable delivery — SMTP remains available as a fallback',
      'Reduced unnecessary bot logging — voice events in servers without auto-create configured no longer generate warnings',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Email delivery upgraded to Azure Communication Services (ACS) for production — password reset emails, magic link emails, and organization deletion notifications are now sent through a dedicated Azure email service with better deliverability and monitoring',
          "Bot logging cleaned up — voice state events in Discord servers that haven't configured voice auto-create no longer generate warning-level log entries on every join/leave/mute action",
        ],
      },
    ],
  },
  {
    version: '2026.05.114',
    date: '2026-05-10',
    title: 'RSI Sync Now Applies Discord Roles & Data Cleanup Fix',
    highlights: [
      'Scheduled RSI sync now correctly assigns and removes Discord roles — previously, automatic syncs could skip role changes silently',
      'Nightly data cleanup job fixed — GDPR-compliant anonymization of old activity records and deletion of expired access logs now runs without errors',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Scheduled RSI role sync now properly assigns and removes Discord roles during automatic syncs — previously, the background worker could not reach the Discord bot, so role changes were silently skipped',
          'Nightly GDPR data cleanup job no longer fails — old access logs are correctly deleted and old activity records are properly anonymized on schedule',
        ],
      },
      {
        category: 'improved',
        items: [
          'The background worker now communicates with the Discord bot via an internal messaging channel, enabling reliable role management during automatic RSI syncs',
        ],
      },
    ],
  },
  {
    version: '2026.05.113',
    date: '2026-05-10',
    title: 'Member Intelligence Moved to Member Audit',
    highlights: [
      'The Member Intelligence panel has moved from Organization Settings → Integrations to the Member Audit & Intel page — find it under the new Intelligence tab alongside Audit Flags, Watchlist, and Members',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Member Intelligence (RSI member list, enrichment, audit, and role validation) is now on the Member Audit & Intel page as a dedicated "Intelligence" tab — no longer buried in Org Settings Integrations',
          'The Integrations tab in Organization Settings is now focused purely on configuration: RSI Verification, RSI Sync, Role Mapping, Discord Server, and Webhooks',
        ],
      },
    ],
  },
  {
    version: '2026.05.112',
    date: '2026-05-10',
    title: 'Organization Settings Restructured — New Recruitment Tab',
    highlights: [
      'Organization Settings now has 4 tabs: General, Recruitment, Integrations, and Encryption — the General tab was getting crowded so the Application Form Builder and Public Profile have been moved to their own Recruitment tab',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Organization Settings General tab is now leaner — it contains only Organization Identity, Feature Toggles, and Danger Zone',
          'New Recruitment tab holds the Application Form Builder (custom application questions) and the Public Profile editor (tagline, logo, focus areas, social links, SCStats visibility)',
          'Tab order is now: General → Recruitment → Integrations → Encryption',
        ],
      },
    ],
  },
  {
    version: '2026.05.111',
    date: '2026-05-10',
    title: 'RSI Name Sync Fix & RSI Organization Tag Display',
    highlights: [
      '"Pull Name from RSI" now works reliably — the sync was previously failing because it relied on a third-party API that is no longer available; it now pulls directly from the RSI website',
      'Organization Settings now shows your RSI Organization Tag (e.g. FRINAUTS) as a read-only field with a direct link to your RSI org page',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          '"Pull Name from RSI" in Organization Settings no longer fails with "Request failed" — the sync now fetches your organization name directly from robertsspaceindustries.com instead of a third-party service that was down',
        ],
      },
      {
        category: 'added',
        items: [
          'Organization Identity card now displays your RSI Organization Tag (e.g. FRINAUTS) as a read-only field when your org is linked to RSI, with a clickable link to view your org on the RSI website',
        ],
      },
    ],
  },
  {
    version: '2026.05.110',
    date: '2026-05-10',
    title: 'Discord Settings Persistence Fix & Org Settings Recruitment Tab',
    highlights: [
      'Discord settings now persist across page refreshes — saving your LFG, events, recruitment, notifications, or any other Discord configuration no longer resets to defaults when you reload the page',
      'Organization Settings has a new Recruitment tab for managing application forms and public profile settings',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord settings (LFG, events, recruitment, ticketing, notifications, role sync, moderation, welcome, audit log) now persist correctly — previously, saving appeared to succeed but a page refresh would reset everything to unconfigured defaults',
          'The Discord Settings page now loads saved values on first visit instead of showing blank defaults, even if you have never saved settings before',
          'If the Discord settings fail to load from the server, you will now see a notification explaining the issue instead of silently falling back to defaults',
        ],
      },
      {
        category: 'improved',
        items: [
          'Organization Settings now has a dedicated Recruitment tab containing the Application Form Builder and Public Profile editor, separate from general settings',
          'The RSI Organization Tag field in Organization Settings now links directly to your RSI organization page',
        ],
      },
    ],
  },
  {
    version: '2026.05.109',
    date: '2026-05-10',
    title: 'Event Voice Channels, LFG Cleanup & Federation LFG Whitelist',
    highlights: [
      'Events now show a voice channel link on the Discord embed — join the VC directly from the event card',
      'Closed LFG posts no longer reappear after a bot restart',
      'LFG cross-org whitelist now supports selecting entire federations, not just individual organizations',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Event embeds in Discord now show a 🔊 Voice Channel field linking directly to the event voice channel',
          'LFG cross-org whitelist autocomplete now shows federations as selectable groups — whitelisting a federation allows all its member organizations',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Closed LFG posts no longer reappear as active after the bot restarts — the Redis session is now cancelled when a post is closed',
          'Cancelling an event now properly cleans up auto-created voice channels instead of leaving them orphaned',
          'LFG voice channel creation no longer crashes if the configured category has been deleted — falls back to the guild root',
        ],
      },
      {
        category: 'improved',
        items: [
          'The Discord bot now waits for the API to become available before accepting interactions — reduces "API did not respond" errors during cold starts',
          'Voice auto-create diagnostic messages are now more visible in logs, making it easier to troubleshoot when channels are not spawning',
        ],
      },
    ],
  },
  {
    version: '2026.05.106',
    date: '2026-05-09',
    title: 'Apply to Join Form Fix',
    highlights: [
      'The "Apply to Join" dialog now loads correctly — the "Failed to load application form" error has been resolved',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Clicking "Apply to Join" on an organization profile or directory card no longer shows "Failed to load application form. Please try again later." — the custom application questions and Discord-based apply modes now load as expected',
          'The membership check when viewing an organization\'s Apply button now works correctly — the button properly shows "You are a member" or "Application Pending" when applicable',
        ],
      },
    ],
  },
  {
    version: '2026.05.105',
    date: '2026-05-09',
    title: 'Discord Bot Reliability Improvements',
    highlights: [
      'The Discord ticket and recruitment panels now recover automatically from temporary connection issues — no more "timeout of 15000ms exceeded" errors',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'The Discord /ticket panel (HR, Recruitment, Diplomacy, General, Technical Support) no longer shows "timeout of 15000ms exceeded" — ticket creation, viewing, closing, claiming, and replying all work correctly now',
          'The Discord /recruitment panel now shows a friendly message if the server is briefly unreachable instead of a raw timeout error',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord bot commands now automatically retry when the server is temporarily unreachable (up to 2 retries with a short delay), reducing the chance of transient errors',
          'Error messages from the Discord ticket panel are now more specific — you\u2019ll see whether the issue is a timeout, a missing server link, or an authentication problem',
        ],
      },
    ],
  },
  {
    version: '2026.05.103',
    date: '2026-05-09',
    title: 'Application Form Questions Fix',
    highlights: [
      'Clicking "Apply to Join" on an organization now correctly shows the custom application questions instead of the generic message box',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Clicking "Apply to Join" on an organization profile or directory card now shows the custom application form questions configured by the org — previously it could show a generic "Message (optional)" field instead',
          'After an org leader updates application form questions in Organization Settings, applicants now see the updated questions immediately instead of seeing stale data for up to 5 minutes',
          'If the application form fails to load (e.g. due to a network error), an error message is now shown instead of silently falling back to the generic message field',
        ],
      },
    ],
  },
  {
    version: '2026.05.102',
    date: '2026-05-09',
    title: 'Event Request Ships Fix',
    highlights: [
      'The Request Ships button on event embeds in Discord no longer shows "This interaction failed" — it now works reliably and shows a clear error if something goes wrong',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Clicking Request Ships on an event embed in Discord no longer shows "This interaction failed" — the ship role picker now opens correctly',
          'If the Request Ships flow encounters a temporary error (database timeout, network issue), you now see a descriptive error message instead of a silent failure',
        ],
      },
    ],
  },
  {
    version: '2026.05.101',
    date: '2026-05-09',
    title: 'Voice Channel Fixes',
    highlights: [
      'The /voice Create Channel button no longer errors out, and temporary voice channels now spawn reliably when the hub is configured',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Clicking Create Channel on the /voice panel no longer shows "Invalid string length" — the template picker modal now opens correctly',
          'Temporary voice channels now detect when the bot is missing permissions in the target category and log a clear warning instead of failing silently — if channels were not spawning after hub setup, make sure the bot has Manage Channels permission in the category',
        ],
      },
    ],
  },
  {
    version: '2026.05.098',
    date: '2026-05-09',
    title: 'LFG Auto-Cleanup & Voice Channels',
    highlights: [
      'LFG posts in Discord now auto-clean themselves — expired and closed posts are removed from the channel automatically, keeping your LFG channel tidy',
      'Creating an LFG group now spawns a temporary voice channel for your team if you are not already in one',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LFG posts now automatically create a temporary voice channel (🎮 LFG: Activity) when you are not already in a VC — join it to start chatting with your group right away',
          'If you are already in a voice channel when creating an LFG post, that channel is linked on the LFG card so others know where to find you',
          'Admins can set a dedicated category for LFG voice channels via the new LFG Voice Category setting in Discord Settings → LFG',
        ],
      },
      {
        category: 'improved',
        items: [
          'Expired LFG posts are now automatically updated to show "CLOSED" with disabled buttons, then deleted from the channel after a short grace period',
          'Manually closed LFG posts (via the Close button) are also cleaned up automatically',
          'Auto-created voice channels are deleted when the LFG post closes or expires — no more orphaned empty channels',
          'Rating DMs are still sent after cleanup — your feedback flow is not affected',
        ],
      },
    ],
  },
  {
    version: '2026.05.097',
    date: '2026-05-09',
    title: 'Voice Auto-Create Fix',
    highlights: [
      'Temporary voice channels now spawn correctly when you join a hub channel — previously they could fail silently on servers with multiple linked organizations',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Joining a hub voice channel now reliably creates your temporary channel and moves you into it — a settings lookup issue on multi-org servers has been resolved',
          'The bot now logs detailed diagnostics when voice auto-create is triggered, making it easier to troubleshoot if something goes wrong',
        ],
      },
    ],
  },
  {
    version: '2026.05.094',
    date: '2026-05-09',
    title: 'Unified Toast Notifications',
    highlights: [
      'All action feedback now uses consistent, animated toast notifications — the same style you see in RSI Sync, now everywhere',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Save, delete, sync, join, leave, and other actions now show polished toast notifications with icon, title, message, and auto-dismiss progress bar — consistent across all pages',
          'Error notifications persist until dismissed so you never miss important feedback',
          'Toast notifications slide in from the right with smooth animations and support reduced-motion preferences',
          'Removed ~45 different per-component notification implementations in favor of one unified system',
        ],
      },
    ],
  },
  {
    version: '2026.05.093',
    date: '2026-05-09',
    title: 'Visual Consistency & Design Tokens',
    highlights: [
      'Unified color system — brand colors, design tokens, and MUI theme are now consistent across the entire platform',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Centralized all third-party brand colors (Discord, Google, Twitch, Ko-fi) into shared constants — visual consistency across login, settings, and landing pages',
          'Expanded the SC design token palette with purple, pink, and blue accent colors for feature showcases and domain-specific displays',
          'Hunter profile medal colors (gold, silver, bronze) now use the centralized design token palette',
          'Crew role badge colors now use MUI Material Design color imports for better consistency',
        ],
      },
    ],
  },
  {
    version: '2026.05.089',
    date: '2026-05-09',
    title: 'Voice Hub Instant Setup',
    highlights: [
      'Setting up a voice hub now immediately creates channels for anyone already in the hub — no disconnect needed',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Configuring a join-to-create voice hub while already connected to the hub channel now creates your temporary channel instantly — you no longer need to disconnect and rejoin',
        ],
      },
      {
        category: 'improved',
        items: [
          'All members sitting in a hub channel at the moment of setup are automatically moved into their own temporary voice channels',
        ],
      },
    ],
  },
  {
    version: '2026.05.088',
    date: '2026-05-09',
    title: 'Real-Time LFG & Activity Updates',
    highlights: [
      'LFG groups now update live — see joins, leaves, and closures instantly without refreshing',
      'Activity participant changes are broadcast in real time across all connected browsers',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LFG page updates in real time when any member joins, leaves, or closes a session — whether from the web app or Discord',
          'Activity events page updates live when participants join or leave — no more stale player counts',
        ],
      },
      {
        category: 'fixed',
        items: [
          'LFG sessions created or modified via Discord buttons now appear instantly on the web LFG page',
          'Activity participant counts now refresh automatically for all viewers, not just the person who joined or left',
        ],
      },
    ],
  },
  {
    version: '2026.05.087',
    date: '2026-05-09',
    title: 'Organization Rename & RSI Name Sync',
    highlights: [
      'Rename your organization directly from Organization Settings — your tag (ID) stays permanent',
      'Pull the latest organization name from RSI with one click if your org is linked',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Organization Identity card in Settings → General tab showing the immutable Tag (ID) and an editable Organization Name field',
          '"Pull Name from RSI" button that fetches your current RSI organization name and applies it — available when your org has an RSI SID linked',
          'Name uniqueness validation ensures no two organizations share the same display name',
        ],
      },
      {
        category: 'improved',
        items: [
          'The organization tag (ID) is now explicitly protected and cannot be changed through any update endpoint',
          'Rename operations are fully audit-logged with before/after values',
        ],
      },
    ],
  },
  {
    version: '2026.05.086',
    date: '2026-05-08',
    title: 'Discord Bot Bug Fixes & LFG Improvements',
    highlights: [
      'LFG join/leave buttons now work after the bot restarts — no more "post not found" errors',
      'LFG reputation panel shows accurate tier, score, and success rate from your full history',
      'Community command buttons and reaction-role delete modal now work correctly',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'LFG join, leave, and close buttons on existing Discord embeds no longer fail after a bot restart',
          'LFG reputation display now shows the correct success rate instead of inflated values',
          'Reaction-role delete modal now replies with a confirmation instead of silently failing',
          'Community command panel buttons are now properly registered and respond to clicks',
          'LFG posts restored from cache now show the correct creator name instead of a blank',
        ],
      },
      {
        category: 'improved',
        items: [
          'LFG reputation panel now shows your combined score, session count, success rate, and average rating from your full play history',
          'When the reputation service is temporarily unavailable, a simplified tier view using your session history is shown instead of breaking',
          'Discord bot commands respond faster by reusing service instances instead of creating new ones per interaction',
        ],
      },
    ],
  },
  {
    version: '2026.05.085',
    date: '2026-05-08',
    title: 'Stale Data Fix, Consent Version Tracking & Privacy Improvements',
    highlights: [
      'Fixed an issue where the app could show outdated data after making changes — all API caching layers have been cleaned up',
      'Privacy consent now always tracks the current policy version, so consent badges show the correct status',
      'Essential consent is now auto-recorded for new users so the consent version badge works from day one',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Removed service worker API caching that was serving stale data after mutations (e.g. editing ships, updating settings)',
          'Added server-side no-cache headers on all API responses to prevent browser HTTP cache from returning old data',
          'Consent records now always store the current policy version instead of potentially keeping an outdated one',
        ],
      },
      {
        category: 'improved',
        items: [
          'Consent Version Badge migrated to React Query for consistent loading and error handling',
          'Essential consent is automatically recorded when you visit Privacy Settings, ensuring the version badge is always accurate',
          'Legacy service worker API cache is automatically cleaned up on app load',
        ],
      },
    ],
  },
  {
    version: '2026.05.084',
    date: '2026-05-07',
    title: 'Bot Reliability, Real-time Updates & Cache Improvements',
    highlights: [
      'Discord bot commands now clearly tell you when your server is not linked to an organization',
      'Bounty and attendance actions from Discord now push real-time updates to the web app',
      'Data consistency improvements — cache invalidation is now centralized and more reliable',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Bot commands fail clearly when a Discord server is not linked to an organization instead of silently using a fallback',
          'Bounty creation via the Discord bot modal now validates input with the same rules as the web app',
          'Attendance confirmations and bounty actions from Discord push real-time updates to the web app via WebSocket',
          'Data cache management refactored for better consistency — mutations now use a centralized invalidation pattern',
        ],
      },
    ],
  },
  {
    version: '2026.05.083',
    date: '2026-05-07',
    title: 'Personal Hangar Fixes — Filters, Pagination, Editing & Adding Ships',
    highlights: [
      'Status and Condition filters on the Personal Hangar page now correctly filter your ship list',
      'All your ships are displayed — pagination no longer gets stuck on the first 20 results',
      'Editing a ship now saves all changes, including clearing fields like Custom Name or Description',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Personal Hangar — the Status and Condition dropdown filters now work correctly; previously selecting a filter had no visible effect on the ship list',
          'Personal Hangar — all ships are now displayed with proper pagination; previously only the first 20 ships were shown regardless of your page size setting or which page you navigated to',
          'Personal Hangar — editing a ship now saves all your changes reliably, including clearing optional fields like Custom Name, Description, or Location back to empty',
          'Personal Hangar — adding a ship to your hangar no longer appears stuck; the ship list refreshes immediately after a successful add',
        ],
      },
    ],
  },
  {
    version: '2026.05.082',
    date: '2026-05-07',
    title: 'Account Linking Feedback, Instant Toggles & LFG Whitelist Picker',
    highlights: [
      'Linking a Discord, Google, or Twitch account now shows a success or error message on the Settings page',
      'Privacy and consent toggles flip instantly and roll back automatically if the server rejects the change',
      'The LFG cross-org whitelist is now a searchable dropdown instead of a manual ID entry field',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Account Linking — after connecting a Discord, Google, or Twitch account you are redirected back to Settings with a clear success or error message',
          'Privacy & Consent — toggles now respond instantly; if the server rejects the change the toggle reverts automatically',
          'LFG Cross-Org Whitelist — searchable dropdown populated from your alliances and federations replaces the old paste-IDs field',
          'Comm Link Tunnels — private tunnels now show the invite code with copy and regenerate buttons in the edit dialog',
          'Personal Hangar — changing filters no longer flashes a loading spinner; previous results stay visible until new data arrives',
        ],
      },
    ],
  },
  {
    version: '2026.05.081',
    date: '2026-05-13',
    title: 'Discord Recruitment Panel Now Reflects Your Live Posting',
    highlights: [
      'Improved: when an admin runs /recruitment Create Panel in Discord, the embed now shows your latest open recruitment posting — title, description, organization name and logo, banner image, roles needed, application count, and a clickable link back to the web posting',
      'Improved: the "Closes" field uses Discord\'s relative timestamp so members always see how long they have left to apply, in their own time zone',
      'Unchanged: the View Positions and Quick Apply buttons still work exactly the same — no action is needed from members or org admins',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Discord bot → /recruitment → Create Panel: the panel embed is now built from the live recruitment posting on Fringe Core. Update the title, description, banner, requirements, or roles on the web at /recruitment/<id>, and the next time an admin posts a panel in Discord those changes appear automatically — no need to maintain a parallel static template in the bot',
          'Discord bot → /recruitment panel: the embed title is a clickable link to the recruitment page on the website, the org logo appears next to the org name in the author slot, and the banner image is displayed at the bottom of the embed when one is set',
          'Discord bot → /recruitment panel: when no recruitment posting is open for the server (or the posting cannot be fetched), the panel falls back to the previous generic template so the command never fails — it just always uses live data when available',
        ],
      },
    ],
  },
  {
    version: '2026.05.080',
    date: '2026-05-13',
    title: 'See and Revoke Pending Invitations',
    highlights: [
      'Added: the Alliance Manage page now shows pending org invitations in their own section above the active members list, so you can see at a glance who you have invited but who has not yet accepted',
      'Added: inviting orgs can now Revoke a pending alliance invitation directly from the new Pending Invitations table, using the same permissions as removing an active member',
      'Added: the Sent Invitations panel on Settings → Members & Permissions now has a clear title, count, and short description so it is easy to identify when shown alongside other panels',
      'Fixed: the "You have N pending invitation" alert on the Dashboard now opens the right page (Settings → Members & Permissions) instead of a 404',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Alliances → Manage → Members tab: pending invitations are now listed in a dedicated, warning-themed Pending Invitations table above the Active Members table. Each row shows the invited organization, the role they were invited at, the proposed association type, the date they were invited, and an "Awaiting response" status. The summary line at the top of the tab now reads "X active organization(s) · Y pending invitation(s)" so you always know the totals',
          'Alliances → Manage → Members tab: rows in the new Pending Invitations table get a Revoke action (visible to anyone who already had permission to remove members). Clicking it asks for confirmation and then withdraws the invitation — the row disappears immediately and the invited org is notified through the same channel as a normal removal',
          'Settings → Members & Permissions → Sent Invitations: the panel now opens with a Mail icon, the heading "Sent Invitations", a count chip showing how many invitations are tracked, and a one-line description. No more guessing which panel is which when several are stacked on the page',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Dashboard: the alert that says "You have N pending invitation(s) sent. Track responses and resend if needed." now opens Settings → Members & Permissions, where the Sent Invitations panel actually lives. Previously the link went to a page that did not exist and you would land on a 404. The Manage Invitations button on the alert behaves the same way',
        ],
      },
    ],
  },
  {
    version: '2026.05.079',
    date: '2026-05-13',
    title: 'Alliance Discord Settings Now Save Reliably',
    highlights: [
      'Fixed: Discord settings toggles on the Alliance Manage page no longer snap back after a moment — your changes are saved on the first click',
      'Fixed: the same issue affected /federation configure, role mappings, and conflict resolution from the bot — all now persist correctly',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Alliances → Discord Settings: flipping any toggle (Auto-create Org Roles, Remove Roles on Org Leave, Remove Roles on User Leave, Kick Non-members, Conflict Resolution Mode, Sync Notification Channel) now saves on the first click. Previously the switch would briefly turn on, the request would report success, then the switch would revert — because the change was never written to the database',
          'Alliances → Role Mappings: assigning a Discord role to an organization or hierarchy tier now persists. The mapping is no longer lost when the page is refreshed',
          'Alliances → Conflict Resolution: resolving a member conflict (assign / remove / skip) now removes it from the queue permanently instead of reappearing on the next page load',
          'Discord bot → /federation configure: changing settings from inside Discord now persists the same way as from the web UI',
          'Discord bot → /federation setup and /federation unlink: linking and unlinking the central guild now correctly stores and clears the associated channel, roles, and mappings',
          'Discord auto-role creation: when a new organization joins your alliance and the bot creates a role for it, the new role-to-org mapping is now saved and will be reused — previously every restart would create a duplicate role',
        ],
      },
    ],
  },
  {
    version: '2026.05.078',
    date: '2026-05-12',
    title: 'Personal Hangar Filters, Search, and Description Editing Fixed',
    highlights: [
      'Fixed: Status / Condition / Sharing Level dropdowns on Personal Hangar now actually filter the ship list',
      'Fixed: editing a ship’s Description field now saves the change instead of silently being dropped',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Personal Hangar: choosing a value from the Status, Condition, or Sharing Level dropdowns previously appeared to do nothing — the full ship list kept showing. The filters now apply correctly and the table updates as soon as you pick a value. The "search by name" box above the list was affected by the same underlying issue and now narrows results by ship name, custom name, description, or notes as documented',
          'Personal Hangar → Edit Ship: typing a value into the Description field and saving now persists the new text. Previously the request returned success but the next time you opened the ship the field was empty again',
        ],
      },
    ],
  },
  {
    version: '2026.05.077',
    date: '2026-05-12',
    title: 'Community Members Filters Now Respect Privacy Settings',
    highlights: [
      'Fixed: the RSI Verified and Has Organization filter chips on Community → Members no longer return people who have chosen to hide that information on their profile',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Community → Members: previously, filtering by “RSI Verified” or “Has Organization” could return members whose cards showed neither the verified badge nor any org chips — because they had turned those badges off in Settings → Privacy & Data. The filters now exclude anyone who has hidden the matching detail, so every result you see actually displays the badge or organization you filtered for',
        ],
      },
    ],
  },
  {
    version: '2026.05.076',
    date: '2026-05-12',
    title: 'Org Logo & Banner Updates Appear Immediately on the Directory',
    highlights: [
      'Fixed: changing your organization logo or banner now updates the public Directory card straight away, instead of taking up to 5 minutes',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Org Settings → Public Profile: when an admin uploads a new logo or banner, the matching card on the public Directory page now refreshes right away. Previously the Organization Profile page already showed the new image, but the Directory tile kept the old one cached for a few minutes — that mismatch is gone',
        ],
      },
    ],
  },
  {
    version: '2026.05.075',
    date: '2026-05-12',
    title: 'Connect Buttons Fixed in Account Settings',
    highlights: [
      'Fixed: the Connect buttons for Google and Twitch in Account Settings → Connected Accounts now work correctly on the live site',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Account Settings → Connected Accounts: clicking Connect next to Google or Twitch previously could send you to a "localhost" address that does not exist outside a developer\'s machine, returning a 404 page. The button now always uses the site you are currently on, so linking additional sign-in providers works on the deployed site',
        ],
      },
    ],
  },
  {
    version: '2026.05.074',
    date: '2026-05-12',
    title: 'Faster Fleet Deletion',
    highlights: [
      'Improved: deleting a fleet — especially in larger organizations with many missions, activities, or sub-fleets — is now significantly faster',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          "Fleet Management → Delete: removing a fleet now completes in a fraction of the previous time. Behind the scenes the database needed extra indexing to clean up references in linked missions, activities, sub-fleets, and the fleet's voice team without scanning entire tables; that indexing has now been added. You will mainly notice this on organizations with hundreds of activities or missions, where deletes that previously took several seconds now feel instant",
        ],
      },
    ],
  },
  {
    version: '2026.05.073',
    date: '2026-05-12',
    title: 'Stronger Privacy on Shared Browsers',
    highlights: [
      "Improved: when one person signs out and another signs in to the same browser tab, the new user no longer briefly sees any of the previous user's personal information",
    ],
    changes: [
      {
        category: 'improved',
        items: [
          "Personal data shown on your screen — your activities, your federations, your ambassador profile, your participation summary, your availability, your Discord guild membership, your profile, your linked accounts, and your privacy settings — is now keyed to the signed-in user behind the scenes. Previously the platform already cleared cached data on sign-out, but if anything was still in flight it could very briefly appear in the next user's view on a shared browser. The new behaviour makes that structurally impossible",
        ],
      },
    ],
  },
  {
    version: '2026.05.072',
    date: '2026-05-12',
    title: 'Bidirectional Discord Scheduled Event Sync',
    highlights: [
      "Cancelling an activity now automatically deletes the linked Discord scheduled event from your server's calendar",
      'Deleting or cancelling a scheduled event directly in Discord now automatically cancels the matching activity in the app — and the change appears in real time for anyone with the page open',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Activities → Cancel: when you cancel an activity that was published as a Discord scheduled event, the event is now removed from the Discord calendar instead of being left behind in a stale state. Previously the in-Discord event could remain visible after the activity had been cancelled in the app, causing confusion for members who only checked Discord',
          'Discord → App sync: if a server moderator deletes or cancels a scheduled event in Discord (for example via right-click → Cancel Event), the linked activity in the app is now automatically marked as cancelled. The Activities page updates immediately for anyone currently viewing it via the live websocket connection',
        ],
      },
    ],
  },
  {
    version: '2026.05.071',
    date: '2026-05-11',
    title: 'Add Ships to Hangar — Search & Filter Fix',
    highlights: [
      'Fixed: searching by ship name and filtering by manufacturer in the "Add Ship" dialog now reliably shows the correct results',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Personal Hangar → Add Ship: typing in the search box or picking a manufacturer no longer occasionally shows an unrelated list of ships. Previously, fast typing or quickly switching the manufacturer dropdown could let an older request finish last and overwrite your current selection — for example you would pick "Banu" and search "Mercha" but see Origin ships instead. The dialog now waits briefly while you type, and ignores any stale results so the list always matches what you have selected',
        ],
      },
    ],
  },
  {
    version: '2026.05.070',
    date: '2026-05-10',
    title: 'Recruitment Apply Button Fix',
    highlights: [
      'Fixed: the "Submit Application" button on recruitment listings now works for everyone — including users who aren\'t a member of any organization yet',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Recruitment listings — clicking "Submit Application" on a recruitment post (for example "Apply: Fringenauts Inc.") no longer silently fails. Previously the request was rejected before it reached the server because the system was incorrectly requiring you to already belong to an organization in order to apply to one. Applying now works whether you are in an org, have switched organizations, or are not in any org yet',
        ],
      },
    ],
  },
  {
    version: '2026.05.069',
    date: '2026-05-09',
    title: 'Privacy Toggle Persistence Fix',
    highlights: [
      'Fixed: privacy toggles in Settings → Privacy & Data now stay where you set them — no more reverting to the previous position after saving',
      'Cookie consent choices are now correctly recorded with the right consent type',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Settings → Privacy & Data: each toggle (Show Bio, Show RSI Info, Show Organizations, Show Ships, Show SCStats, Show Activity, Show Verified Badge, Show Email, Show Discord, and Profile Visibility) now persists correctly when changed. Previously, the toggle would briefly appear to flip but then snap back to its prior position after the page refreshed',
          'Cookie & Consent banner: granting or withdrawing consent now records the correct consent type (analytics, marketing, etc.) — previous code paths could mis-route the consent record',
        ],
      },
    ],
  },
  {
    version: '2026.05.068',
    date: '2026-05-08',
    title: 'Membership Display Fix on the Public Org Directory',
    highlights: [
      'Fixed: brand-new users no longer see another person\'s organization (e.g. Fringenauts Inc.) shown as "Member" on the public organization directory after a previous user signed out on the same browser',
      'Logging out now fully clears the in-app data cache so the next person who signs in starts with a clean slate',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Public Organizations directory — the "Member" badge on each org card is now correctly tied to the currently signed-in user. Previously, on a shared browser, the badge could briefly show another user\'s membership before refreshing',
          'Sign out — the app now wipes its in-memory data cache on logout, preventing any cached personal data from being shown to the next user',
        ],
      },
    ],
  },
  {
    version: '2026.05.067',
    date: '2026-05-07',
    title: 'Security Hardening, DM Retry Queue & Activity Sync',
    highlights: [
      'OAuth login is now protected with PKCE and redirect-URL validation for stronger security',
      "Failed Discord DMs are now retried automatically up to 3 more times so you don't miss notifications",
      'Cancelling, rescheduling, or deleting an activity now updates the linked Discord event automatically',
      '/commlink now opens a clean button panel instead of requiring typed subcommands',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'DM Retry Queue — if a Discord DM fails to send (DMs disabled, rate limit, etc.), the system retries automatically with exponential backoff over the next 2 hours',
          'Activity↔Discord Sync — cancelling, rescheduling, or deleting an event now updates or removes the linked Discord Scheduled Event automatically',
        ],
      },
      {
        category: 'improved',
        items: [
          'OAuth Security — login flows are now protected with PKCE (Proof Key for Code Exchange) and redirect-URL validation',
          '/commlink: typing /commlink now always shows the full action panel with 8 buttons. New "Link by Code" button for quick invite code connections',
          'LFG rate limits now work correctly across multiple bot instances (moved to Redis)',
        ],
      },
    ],
  },
  {
    version: '2026.05.066',
    date: '2026-05-06',
    title: 'Fleet Deletion Reliability',
    highlights: [
      'Deleting a fleet no longer leaves a broken detail panel — the view automatically returns to the fleet overview',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fleet Manager: deleting a fleet that was already removed by another session or admin no longer shows repeated "Not Found" errors — the detail panel clears automatically',
          'Fleet Manager: if a fleet disappears while you are viewing it (e.g., deleted by another user), the panel now shows a brief error and returns to the overview instead of continuously retrying',
        ],
      },
    ],
  },
  {
    version: '2026.05.065',
    date: '2026-05-06',
    title: 'Comm Link Slash Command & Content Filter Fix',
    highlights: [
      '/commlink is now a full slash command — list, create, delete, and configure comm links directly from the / menu',
      'Content filter toggle now saves correctly when disabled',
    ],
    changes: [
      {
        category: 'added',
        items: [
          '/commlink command: use /commlink list, /commlink create, /commlink delete, /commlink settings, /commlink join, /commlink leave, /commlink link, and /commlink info directly from the slash menu — or run /commlink to see the button panel',
          '/voice command is now available directly in the / menu',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Comm Links: toggling the content filter OFF in the edit dialog no longer reverts to ON after saving',
          'Voice Channels: saving voice channel settings with an empty Hub Channel or Parent Category no longer fails silently — optional fields are now properly omitted',
        ],
      },
    ],
  },
  {
    version: '2026.05.064',
    date: '2026-05-06',
    title: 'Cross-Org LFG Whitelist & Game Restrictions',
    highlights: [
      'Cross-Organization LFG now supports an organization whitelist — only show LFG posts from specific allied orgs',
      'Allowed Games defaults to Star Citizen only instead of all games',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LFG: new "Whitelisted Organizations" field appears when Cross-Organization LFG is enabled — enter org IDs (one per line) to restrict which allied organizations\' LFG posts you see. Leave empty to see all allied orgs',
        ],
      },
      {
        category: 'improved',
        items: [
          'LFG: the Allowed Games setting now defaults to Star Citizen only when left empty, instead of allowing all games',
        ],
      },
    ],
  },
  {
    version: '2026.05.063',
    date: '2026-05-06',
    title: 'Alliance Discord Settings Fix',
    highlights: [
      'Alliance Discord settings toggles now work for council members — not just founders and leaders',
      'Saving Discord settings now shows clear error messages instead of silently failing',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Alliances: Discord settings toggles (auto-create org roles, remove roles on leave, kick non-members, conflict resolution, sync channel) were unresponsive for council members — permission check now matches the backend',
          'Alliances: toggling a Discord setting that failed to save no longer silently reverts — an error message is shown',
          'Alliances: the sync notification channel field now loads the saved value when the page opens instead of starting blank',
        ],
      },
    ],
  },
  {
    version: '2026.05.062',
    date: '2026-05-06',
    title: 'Event Mirrors, Discussion Threads & Voice Channel Defaults',
    highlights: [
      'Mirroring events is now easier — the bot shows a searchable list of upcoming events instead of requiring you to paste an ID',
      'Events can now auto-create a discussion thread for participant coordination',
      'Configure when event messages get cleaned up — after the scheduled end time or after marking complete',
      'Admins can set default user limits and audio quality for auto-created voice channels',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Event Mirror Picker — select from a list of upcoming events to mirror instead of pasting an ID',
          'Event Discussion Threads — toggle auto-creation of a discussion thread when events are announced',
          'Event Cleanup Modes — choose between cleanup after scheduled end or after completion, with a configurable delay',
          'Voice Channel Defaults — set default user limit, audio bitrate, and whether users can adjust the limit for temporary channels',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fleet deletion no longer causes a brief error flash — the selected fleet is cleared before the delete request',
          'Voice channel settings now correctly save user limit and bitrate instead of sending the wrong field names',
          'Discord settings channel pickers now use searchable autocomplete for faster selection',
        ],
      },
    ],
  },
  {
    version: '2026.05.061',
    date: '2026-05-06',
    title: 'Help Center, Community Command & Verify Panel',
    highlights: [
      'The /help command is now a full Help Center — search the Wiki and browse FAQs directly in Discord',
      'New /community command brings giveaways, polls, announcements, and community tools into one panel',
      'The ticket panel now shows open recruitment positions with one-click apply buttons',
      'The /verify panel now shows step-by-step RSI verification instructions visible to all members',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Help Center — /help now includes Wiki search (find articles by keyword) and FAQ browsing (by category or search) directly in Discord modals',
          '/community command — access giveaways, polls, announcements, and community features from a single panel',
          'Ticket Recruitment — clicking "Recruitment" in the ticket panel shows open positions with apply buttons instead of creating a generic ticket',
        ],
      },
      {
        category: 'improved',
        items: [
          'Verify Panel — now shows detailed step-by-step instructions for RSI verification, visible to all channel members for easy onboarding',
          'Ship catalogue now loads the full list (up to 500 ships) for complete browsing',
        ],
      },
    ],
  },
  {
    version: '2026.05.060',
    date: '2026-05-06',
    title: 'Comm Link Word Moderation Toggle, Embed Reply Previews & Participant Fixes',
    highlights: [
      'You can now turn the comm-link word filter on or off from `/commlink settings` — useful for trusted private tunnels where moderation gets in the way',
      'Replying to a Discord message that only contains an embed (event card, briefing, etc.) now carries a real preview across the bridge instead of a generic "[attachment/embed]" placeholder',
      'Activity / event pages now correctly show every participant — they were previously empty on first load due to a hydration bug',
      'Discord event embeds now mention real Discord users (clickable @mentions) instead of showing internal user IDs',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Comm Link Word Moderation Toggle — a new `Toggle word moderation` option in `/commlink settings` lets tunnel owners enable or disable the profanity / spam filter on demand. The setting is per-tunnel and persists across restarts',
          'Reply Embed Previews — when you reply to a message that only has a rich embed (no text), the relayed reply now shows the embed title and description as the quoted preview. Attachments show the filename, stickers show as `[sticker]`',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Empty Participants on Activity Pages — single-activity views (public link, internal page, after join / leave / update) sometimes returned an activity with zero participants even when there were many. The participants list is now correctly hydrated on every single-activity endpoint',
          'Broken @Mentions in Event Embeds — Discord event embeds now use real Discord snowflakes for `@mentions`, producing clickable user references instead of literal `<@uuid>` text. Users without a linked Discord account fall back to a bold username instead of breaking the embed',
        ],
      },
    ],
  },
  {
    version: '2026.04.250',
    date: '2026-04-26',
    title: 'Friends, Org Invites, Bounty Hunter Profile & Smarter Recruitment',
    highlights: [
      'Friend requests now stick — send, accept, reject, or remove friends and the connection persists across sessions',
      'Organizations can now invite players directly with a status-tracked invitation list',
      'The Bounty Hunter tab on your profile shows your real hunter stats — no more placeholders',
      'Recruitment applications now use rich, structured questions (short answer, paragraph, choice) instead of plain text labels',
      'Fleet commanders can now add, update, or remove members across multiple fleets in a single action',
    ],
    changes: [
      {
        category: 'added',
        items: [
          "Friends — send, accept, reject, cancel, and remove friend requests. Your friend list, incoming requests, and outgoing requests now load from a real database and survive page reloads. You can't friend yourself, and duplicate requests are blocked",
          'Organization Invitations — org admins can invite players, see all invitations filtered by status (pending / accepted / revoked), and revoke pending ones. Includes paginated lists for large orgs',
          'Bounty Hunter Profile Tab — the Bounty Hunter tab on user profiles is now wired to your real hunter stats, including kills, claimed bounties, and recent activity',
          'Fleet Bulk Member Operations — fleet commanders can add, update roles for, or remove multiple members across one or more fleets in a single request. Team capacity automatically recalculates afterward',
          'Recruitment Application Questions — recruitment posts now support structured questions (short answer, paragraph, single choice, multi-choice) with required flags and ordering. Existing comma-separated questions are automatically migrated to the new format',
        ],
      },
      {
        category: 'improved',
        items: [
          "Bot Moderation Permissions — `/ban`, `/kick`, and message-management commands now check the requester's Discord permission flags (BanMembers, KickMembers, ManageMessages) before executing",
          'Bot Unban Logging — using the bot to unban a user now persists the action to the moderation log',
          'Background Jobs — GDPR data cleanup and intel audit log rotation jobs are now active and run on schedule',
          'Notification Routing — rate-limit alerts and outgoing webhook deliveries now flow through a single notification dispatcher for consistent delivery and tracking',
        ],
      },
      {
        category: 'fixed',
        items: [
          "Friends List Persistence — previously, friend connections were lost between sessions. Now they're backed by a proper database table",
          'Bounty Hunter Tab Missing — the Bounty Hunter tab was sometimes hidden on profiles where it should appear; the tab list now registers it correctly',
        ],
      },
    ],
  },
  {
    version: '2026.04.249',
    date: '2026-04-25',
    title: 'Event Embed Visual Refresh & Crew Join Fix',
    highlights: [
      'Event embeds now have clear visual separators between sections — schedule, participants, ships, and fleet are easier to scan at a glance',
      'Fixed a bug where joining crew on an event with multiple ships from the same owner would always assign you to the wrong ship',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Event embeds now have horizontal dividers between major sections (schedule, participants, ships, fleet) for better readability',
          'Ship entries within the fleet section are separated by visual dividers instead of running together',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Crew Join — when an event has multiple ships from the same player, clicking "Join Crew" now correctly assigns you to the ship you selected instead of always picking the first one',
        ],
      },
    ],
  },
  {
    version: '2026.04.248',
    date: '2026-04-25',
    title: 'Ship Requirements: Grouped Picker & Manual Entry',
    highlights: [
      'The ship requirements picker now groups ships by role or alphabetically — find the right ship faster',
      'New "Enter Manually" option: type any ship name and the system auto-fills details from the catalogue',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Ship Requirements Picker — ships are now organized in groups (by role like Combat, Transport, Mining — or alphabetically A–Z). Sticky group headers make browsing easier',
          'Manual Ship Entry — click "Enter Manually" to type a ship name. If it matches the catalogue, crew count and role auto-populate. For custom/unreleased ships, set the crew count yourself',
          'Ship catalogue now loads the full list (500 ships) instead of the first 100, so you can find any ship',
        ],
      },
    ],
  },
  {
    version: '2026.04.247',
    date: '2026-04-25',
    title: 'Ship Nesting, Hangar Browsing & LFG Improvements',
    highlights: [
      'After adding a ship to an event, the bot now offers to dock it inside carrier ships like the Carrack, Idris, or Hercules',
      'Users with large hangars (25+ ships) now get a paginated ship picker with letter groups and a "Matching Requirements" shortcut',
      "If you add a second ship while already crewing one, it's automatically registered as a loaner for other members",
      'LFG panel now includes Auto-LFG and Smart Ping buttons',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Ship Nesting — after bringing a ship, the bot checks if any carrier ships in the event can transport it. Choose to dock in their hangar bay or cargo bay, or keep your ship independent',
          'Hangar Multi-Page Browsing — if you have more than 24 ships, the ship picker now shows letter-range groups (A–F, G–M, etc.) plus a dedicated "Matching Requirements" group for ships that fit the event',
          'LFG Auto-LFG — toggle automatic LFG post creation when you start playing a game in a voice channel',
          'LFG Smart Ping — view and configure intelligent ping settings for new LFG posts',
        ],
      },
      {
        category: 'improved',
        items: [
          "Loaner Ship Detection — when you add a second ship while already crewing another, it's automatically marked as a loaner so other members can crew it",
          'Event Creation — the bot now links events to your web app account instead of your Discord ID, so your RSVP and ship selections sync correctly across both platforms',
          'Event Creation — clear error message when the Discord server is not linked to an organization',
        ],
      },
    ],
  },
  {
    version: '2026.04.246',
    date: '2026-04-25',
    title: 'Event Participant Data & Voice Channel Category',
    highlights: [
      'Event embeds now show accurate, real-time participant data from the normalized database instead of a cached snapshot',
      'The "Bring Ship" button now correctly finds ships from your hangar even if your Discord and web accounts use different IDs',
      'New setting: choose which Discord category event voice channels are created in',
      'Calendar now shows the correct participant count for all activities',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Event embeds in Discord now pull participant data from the real-time database table — RSVP changes are reflected immediately without waiting for a cache refresh',
          'Creating an activity now immediately registers you as the leader in the participant list — your RSVP, ship selection, and crew management work from the moment the event is created',
          'Calendar events show the actual participant count from the database instead of counting a potentially stale list',
        ],
      },
      {
        category: 'added',
        items: [
          'Event Voice Channel Category — choose which Discord category new event voice channels are created under, from the Discord Settings page (under Event Settings, when "Create Discord Event" is enabled)',
        ],
      },
      {
        category: 'fixed',
        items: [
          '"Bring Ship" and ship selection from your hangar now work correctly — the bot translates your Discord ID to your web account automatically. If you haven\'t linked your accounts yet, you\'ll see a helpful message explaining how',
          "Temp role color validation now accepts Discord's integer color format instead of a string, matching how Discord actually stores colors",
        ],
      },
    ],
  },
  {
    version: '2026.04.245',
    date: '2026-04-21',
    title: 'Teams Emblem, Ship Catalogue Enrichment & Encryption Fixes',
    highlights: [
      'Teams and fleets now display their emblem (logo) in the tree view, detail panel, and fleet list',
      'Organization ships and member ships are now enriched with game-catalogue metadata (role, size, manufacturer) directly from the server, making filters more accurate',
      'The Interdiction Planner is now available as a reference tool in the Briefing sidebar',
      'Encryption key unlock is more resilient — handles double-encoded key wrappers gracefully',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Teams: emblem/logo image now shown in the Team tree view, detail panel header, and fleet list chips',
          'Briefings: Interdiction Planner added to the Reference Tools panel in the sidebar — opens in a new tab for quick access',
          'Organization Ships: ship filters now use authoritative role, size, and manufacturer from the game catalogue (resolved server-side), with client-side fallback for resilience',
        ],
      },
      {
        category: 'improved',
        items: [
          'Encryption: key wrapper parsing extracted into a dedicated `parseKeyWrapper()` utility — handles JSON, already-parsed objects, and double-encoded strings with clear error messages',
          'Intel Vault: query key factories moved to `queryKeys.ts` for consistency — mutations now properly invalidate audit logs',
          'Intel Officers: audit log descriptions now show usernames instead of user IDs',
          'User Ship Summary: endpoint now uses `res.success()` for consistent API response envelope',
          'Key Vault: all Azure SDK calls now include a 15-second abort timeout to prevent 504 gateway timeouts',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fleet type now includes the `emblem` field, fixing a TypeScript build error in the fleet list',
          'Frontend Dockerfile: static asset cache rule no longer intercepts `/api/` image proxy URLs',
        ],
      },
    ],
  },
  {
    version: '2026.04.244',
    date: '2026-04-21',
    title: 'Image Security Hardening',
    highlights: [
      'All avatar and profile images are now sanitized before display, preventing potential XSS attacks via malicious image URLs',
      'Images stored as bare filenames in the database are now displayed correctly instead of showing as broken',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Avatar images across badges, fleet crew, member rosters, organization logos, and activity participants are now fully sanitized — blocking any unsafe URL schemes while preserving valid images',
          'Images stored in the database as bare filenames (without a path) now display correctly by automatically routing through the image proxy',
        ],
      },
    ],
  },
  {
    version: '2026.04.243',
    date: '2026-04-21',
    title: 'Event Embeds, Cancel Button & Trade Data Resilience',
    highlights: [
      'Event embeds now show transported vehicles nested under their parent ship',
      'Fleet capabilities (Refuel, Repair, Medical, Carrier, etc.) auto-detected and shown as badges',
      'Event creators can cancel events directly from Discord with a new Cancel button',
      'Trade data stays available when the external price API is temporarily down',
      'Admin login now works for superadmin accounts with clearer error messages',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Event embeds: transported vehicles and snub fighters now appear nested under their parent ship (e.g. a Tonk inside a Hercules)',
          'Event embeds: fleet capability badges automatically detected — shows Refuel, Repair, Rearm, Medical, Carrier, and Scanning when the fleet includes capable ships',
          'Event embeds: banner images now display when set on the event',
          'Cancel Event button — event creators can cancel directly from the Discord embed without visiting the website',
          'Trade data resilience — commodity prices, routes, and terminal data remain available using cached values when the UEX price API is temporarily unavailable',
        ],
      },
      {
        category: 'improved',
        items: [
          '"Leave" button renamed to "Withdraw" for clarity, with updated emoji',
          'Crew members now shown under their ship assignment in event embeds instead of duplicated in the participant list',
          'Admin login accepts both admin and superadmin roles; shows clearer error messages with your actual role when access is denied',
          'Logistics page now properly requires an active organization — no more blank page without one',
          'Ship list no longer shows deleted/inactive ships',
          'Image upload URLs are now absolute, fixing display in Discord embeds and cross-origin contexts',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Invalid or expired login tokens now correctly return "unauthorized" instead of "forbidden" — fixes some browsers failing to refresh the session',
          'Authentication data is no longer cached by the browser, preventing stale session data after login/logout',
          'Avatar preview and map export now work correctly with Content Security Policy (blob: URL support added)',
          'Announcement, inventory, and logistics data no longer loads before you select an organization',
          'Moderation incident search now returns pagination info correctly',
          'Refresh token URL corrected — fixes "Failed to refresh" errors on some browsers',
        ],
      },
    ],
  },
  {
    version: '2026.04.242',
    date: '2026-04-21',
    title: 'Shared Accounts, Interdiction UX & Ship Catalogue',
    highlights: [
      'Shared accounts in the Intel Vault — store and manage organization credentials with encrypted storage and audit logging',
      'Interdiction Planner now supports focal-point zoom, left-click panning, fit-all button, and PNG map export',
      'Comm link tunnel names are now persisted — no more waiting for Discord API lookups on every page load',
      'Intel officer management shows real usernames and formatted audit actions',
      'Organization chart has independent zoom controls for role tiers and team trees',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Shared Accounts — manage organization credentials (service accounts, shared logins, API keys) in the Intel Vault with encrypted storage, reveal-password flow, and full audit trail',
          'Interdiction Planner: focal-point zoom (zoom toward your cursor), left-click panning with automatic click-vs-drag detection, and a fit-all-locations button to reset the view',
          'Interdiction Planner: PNG map export — save your interdiction plan as an image for briefings or Discord',
          'Interdiction Planner: system selector changed from dropdown to toggle buttons for faster switching between Stanton, Pyro, and Nyx',
          'System map: additional Lagrange points, stations, and jump points added to Stanton and Pyro',
          'Intel officer list now shows usernames instead of user IDs, and audit log actions are formatted for readability',
          'Intel officer list supports filtering by rank and showing inactive officers',
          'Organization chart: independent zoom controls for role-tier view and team-tree view, with narrower cards for better fit',
        ],
      },
      {
        category: 'improved',
        items: [
          'Comm link tunnel names are now saved when created or connected — subsequent page loads show real server and channel names instantly without hitting the Discord API',
          'Organization ships page now fetches up to 500 ships at once (was 100) so large fleets are no longer silently truncated',
          'Ship catalogue allows up to 500 items per page for faster browsing of the full ship database',
          'Logout flow no longer races with automatic re-authentication — a guard prevents cookie-based login during the logout process',
          'Service worker no longer caches authentication API responses, preventing stale session data after login/logout',
          'Image uploads now fall back to local storage when Azure returns a file-not-found error, not just when Azure is completely unavailable',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Intel routes: removed duplicate V1 route mounting on V2 path that was returning unwrapped responses for some operations',
          'Refresh token URL corrected from /auth/refresh to /api/v2/auth/refresh — fixes "Failed to refresh" errors on some browsers',
          'Image upload and download endpoints refactored to eliminate duplicate code paths',
        ],
      },
    ],
  },
  {
    version: '2026.04.241',
    date: '2026-04-20',
    title: 'Interdiction Planner, Jump Points & Profile Improvements',
    highlights: [
      'New Interdiction Planner page for planning quantum interdiction points with jump point maps',
      'Jump points now appear on the Stanton, Pyro, and Nyx system maps as diamond markers',
      'Comm link cards now show real Discord server and channel names from the bot',
      'Trade routes table shows when prices were last updated',
      'Avatar uploads validated client-side with inline error messages',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Interdiction Planner — a dedicated page for planning quantum interdiction points, accessible from the Ops hub and command palette',
          'Jump points added to system maps: Stanton (Pyro, Magnus, Terra), Pyro (Stanton, Nyx, Castra), and Nyx (Pyro, Odin) — displayed as diamond markers with dashed orbit rings',
          'Trade routes table now shows an "Updated" column with the last price update date and time',
          'Activity detail page now shows the Activity ID in a monospace font for easier reference',
          'Activity detail page resolves the organization name from the org ID when the name is not embedded in the activity',
          'User profile avatar uploads are now validated client-side — files must be images under 5 MB, with clear inline error messages instead of browser alert dialogs',
          'Profile save errors now display inline Alert banners with specific messages, including a dedicated message for oversized avatars (413 Payload Too Large)',
        ],
      },
      {
        category: 'improved',
        items: [
          'Comm link cards and the edit dialog now show real Discord server and channel names fetched from the bot API, instead of raw IDs',
          'Intel officer appointment dialog Save button now correctly disables during the mutation, preventing double-submissions',
          'Service worker files (sw.js, workbox) are now served with no-cache headers to ensure browsers always pick up new deployments',
          'Frontend nginx now allows file uploads up to 10 MB, matching the backend limit',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Organization application service now reads API responses correctly — removed redundant envelope unwrapping that caused "undefined" errors on the Organization Profile page',
          'Intel officer management rate limit raised from 15 to 30 requests per 15 minutes to prevent false rate-limit errors during bulk operations',
        ],
      },
    ],
  },
  {
    version: '2026.04.240',
    date: '2026-04-20',
    title: 'Watchlist Screening, Comm Link Editing & Retry Improvements',
    highlights: [
      'Recruitment and org applications now check the citizen watchlist — flagged RSI handles are blocked automatically',
      'Comm links can now be renamed and edited (content filter, bot messages, max servers) from the Discord Settings page',
      'API retry logic no longer compounds with React Query — failed requests settle faster instead of retrying excessively',
      'Federation branding uploads now show clear error messages and enforce a 5 MB limit',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Recruitment & org applications now check the citizen watchlist — if your RSI handle is flagged, your application is blocked with a clear message',
          'Comm link cards now show which servers and channels are connected, with guild and channel names displayed as chips',
          'Comm links can now be edited — click the pencil icon to rename, toggle content filtering, allow/deny bot messages, and set the max connected servers',
          'Federation logo and banner uploads now show clear error alerts when an upload fails, with the specific error message from the server',
          'Federation image uploads are validated client-side — files larger than 5 MB are rejected before uploading',
          'Recruitment questions are now returned in the application mode response for all modes (discord, custom, simple), so the form always has them available',
        ],
      },
      {
        category: 'improved',
        items: [
          'Permission checks now use the consolidated isOwnerRole / isOwnerOrAdminRole utilities — the founder role is correctly treated as owner across encryption, intel, and permission services',
          'API client no longer retries on 500 Internal Server Error (only 408, 502, 503, 504) since 500s are typically not transient',
          'After the API client exhausts its own retries, errors are marked as not-retryable to prevent React Query from compounding additional retry cycles',
          'PWA service worker now uses StaleWhileRevalidate caching for JS and CSS files instead of precaching — eliminates 404 errors after deployments when cached chunk filenames change',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Role mapping panel: the delete confirmation dialog now closes properly after deletion and shows a loading spinner while the request is in progress',
          'Docker container: the local image uploads directory now matches the path used by the image controller (data/uploads instead of public/uploads)',
          'Recruitment service: the frontend now correctly parses the paginated response from the backend instead of treating the wrapper object as the data array',
          'Connected channel count on comm link cards now uses correct singular/plural ("1 connected channel" vs "2 connected channels")',
        ],
      },
    ],
  },
  {
    version: '2026.04.239',
    date: '2026-04-17',
    title: 'RSI Role Mapping Templates Now Match RSI Structure',
    highlights: [
      'Role mapping templates now include all 4 RSI roles (Founder, Officer, Recruitment, Marketing) and all 6 star-based ranks (0–5)',
      "Default rank names use the RSI defaults (Rank 5 through Rank 0) — your org's custom names are discovered during sync",
      'Every template entry now assigns a web role automatically',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'RSI role mapping templates (Standard, Military, Corporate) now correctly include all 4 fixed RSI roles and all 6 star-based ranks — previously the Officer, Recruitment, and Marketing roles were missing, and rank names did not match RSI',
          'Default star-rank names now use RSI defaults (Rank 5 through Rank 0) — when your org customises these on RSI, the platform discovers the new names during sync',
          'All template entries now include a web role assignment — lower ranks previously had none, leaving users without permissions after applying a template',
          'The role mapping dropdown now always shows all available RSI roles and star levels, even before running an RSI sync',
          'New organizations automatically get the correct RSI-matching rank and role structure on creation',
        ],
      },
    ],
  },
  {
    version: '2026.04.238',
    date: '2026-04-17',
    title: 'All Commands Panel-Only, Cleaner Menu, Profile Badges',
    highlights: [
      'All 28 bot commands now open a visual panel — no subcommands to type',
      'The / command menu is reduced to 13 core commands; everything else is one tap away via /help',
      'Your profile now shows badges from all your organizations',
      'Activity timeline respects your privacy settings',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Bot: every remaining command converted to panel-only — 12 new panels for events, LFG, giveaway, ticket, recruitment, poll, roles, embed, guild, FAQ, voice, and wiki',
          'Bot: the / command menu now shows only 13 core commands plus /help and /ping — admin and setup tools are in /help > Server Setup & Admin, extra features in /help > More Features',
          'Bot: hunter profile is now inside /bounty, briefings inside /mission, schedule and attendance inside /events',
        ],
      },
      {
        category: 'added',
        items: [
          "Profiles: your user profile now shows badges from all your organizations, with each org's name and logo",
          'Profiles: activity timeline and heatmap now respect the "Show Activity" privacy setting — other users only see your activity when you opt in',
          'Recruitment: endpoints are now available under the /api/v2/recruitment/ path for consistency with the rest of the API',
        ],
      },
      {
        category: 'fixed',
        items: [
          "Ships: viewing another player's public hangar now correctly filters by sharing level instead of a legacy flag, so publicly shared ships appear as expected",
        ],
      },
    ],
  },
  {
    version: '2026.04.237',
    date: '2026-04-17',
    title: 'Image Security & Federation Fix',
    highlights: [
      'Uploaded images are stored privately and served only through authenticated endpoints',
      'CDN edge caching for faster image delivery',
      'Fixed federation Discord server recognition for newly linked servers',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Image uploads are now stored in a private directory — access requires authentication through the download endpoint',
          'Image deletion and listing now requires administrator privileges',
          'Avatar uploads are rate-limited to 5 per 15 minutes',
          'Avatar URL validation blocks dangerous protocols like javascript:',
          'SVG files are no longer accepted since they can contain embedded scripts',
          'Downloaded images are cached at the CDN edge when Azure Front Door is enabled',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Federation: linking a Discord server to a federation still in the forming stage now works immediately — the server is recognized right away instead of only after the federation reaches active status',
        ],
      },
    ],
  },
  {
    version: '2026.04.236',
    date: '2026-04-16',
    title: 'Panel-Only Commands & Smart Dropdowns',
    highlights: [
      'Sixteen bot commands now open visual button panels automatically — no subcommand typing needed',
      'Smart dropdowns show your real data (events, bounties, missions) so you just pick from a list',
      'New panels for /attend, /hunter, /discover, /diplomacy, and /federation',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Bot: 16 commands now open a visual panel by default — just type the command and see all actions as buttons',
          'Bot: smart dropdowns populate with your real data — pick an event, bounty, or mission from a list instead of typing an ID',
          'Bot: federation settings are now configured through cascading dropdown menus instead of typed values',
          'Bot: reminder and mission buttons show your upcoming events and active missions',
        ],
      },
      {
        category: 'added',
        items: [
          'Bot: /attend panel with attendance history, leaderboard, confirm, and event report buttons',
          'Bot: /hunter panel with profile, claims, stats, and leaderboard',
          'Bot: /discover panel with opportunity browsing, group finding, and participation stats',
          'Bot: /diplomacy panel with treaty proposals, incident reporting, and alliance management',
          'Bot: /federation panel with setup, status, configure, and role sync',
        ],
      },
    ],
  },
  {
    version: '2026.04.235',
    date: '2026-04-16',
    title: 'Bot Command Panels: Visual Menus for Every Command',
    highlights: [
      'Eleven bot commands now have a /command panel option that shows an interactive button menu',
      'Browse all available actions at a glance instead of remembering subcommand names',
      'Simple actions run instantly from a button tap — no typing required',
      'All existing slash subcommands still work as before',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Bot: /announce panel opens a button menu for creating, listing, sending, scheduling, and managing announcement templates',
          'Bot: /bounty panel lets you browse bounties, view your claims, check stats, and claim bounties from a visual menu',
          'Bot: /stats panel shows buttons for personal stats, invite leaderboard, and message/voice leaderboards',
          'Bot: /briefing panel, /mission panel, /commlink panel, /moderation panel, /notify panel, /schedule panel, /reminder panel, and /verify panel added',
          'Bot: actions that need extra input (like an ID) open a quick form right in Discord',
          'Bot: the /help command now mentions the panel feature',
        ],
      },
      {
        category: 'improved',
        items: [
          'Bot: command discoverability is significantly better — new users can see all options without memorizing subcommand names',
          'Bot: mobile experience improved — tapping buttons is easier than typing full slash subcommands on a phone',
        ],
      },
    ],
  },
  {
    version: '2026.04.234',
    date: '2026-04-16',
    title: 'Events Overhaul: Ship Hangar, Cleaner Embeds, Creation Wizard',
    highlights: [
      'Event embeds are now more compact — key details are displayed on a single line instead of separate fields',
      'Clicking Bring Ship now shows ships from your hangar so you can pick one instantly',
      'Request Ships still uses the full catalogue so organizers can specify exactly what the event needs',
      'Crew positions are determined by ships brought instead of manually assigned roles',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Events: type, status, location, organization, and visibility are now shown in a compact single line instead of taking up five separate fields',
          'Events: the When field now shows the date and relative time on one line instead of two',
          'Events: clicking Bring Ship shows ships from your hangar — pick one and it fills in automatically',
          'Events: Request Ships still uses the global catalogue so organizers can specify exact requirements by Role and Type',
          'Events: crew positions are now determined by the ships people bring — the wizard no longer asks you to set role counts',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Events: the Bring Ship, Enter Manually, and Request Ship modals now open correctly — a Discord API error was preventing them from appearing',
          'Events: clicking Join no longer assigns you to the DPS role by default — you start as Member',
        ],
      },
    ],
  },
  {
    version: '2026.04.233',
    date: '2026-04-16',
    title: 'Alliance Discord Setup from Bot',
    highlights: [
      'Link a Discord server as your alliance hub directly from Discord with /federation setup',
      'Check status, toggle settings, and sync roles — all without leaving Discord',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Alliances: /federation setup links a Discord server as the alliance hub directly from Discord',
          'Alliances: /federation status shows the full integration overview — linked federation, roles, channels, and any user conflicts',
          'Alliances: /federation configure toggles auto-create org roles, remove on leave, kick non-members, and conflict resolution from Discord',
          'Alliances: /federation sync-roles creates missing org roles and verifies structural roles',
          'Alliances: /federation unlink cleanly disconnects the server and clears role mappings',
        ],
      },
    ],
  },
  {
    version: '2026.04.232',
    date: '2026-04-16',
    title: 'LFG Multi-Game, Public LFG, Server Visibility',
    highlights: [
      'LFG posts now display which game is being played and can be shared across servers',
      'Admins can configure game filters, public LFG delivery, and opt-in roles',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LFG: posts now display the game being played — use the game option in /lfg create to specify a different title',
          'LFG: mark a post as public to share it with other servers via DM or a designated channel',
          'LFG: post embeds show which servers the post was published to, and the creator gets a summary',
          'LFG Web Settings: new Game Settings and Public LFG sections for configuring defaults, allowed games, delivery method, and opt-in role',
          'LFG Bot: /lfg settings lets admins view and update game and public LFG settings from Discord',
        ],
      },
      {
        category: 'improved',
        items: [
          'LFG: activity type, status, and game name are now shown in a compact inline row instead of separate fields',
        ],
      },
    ],
  },
  {
    version: '2026.04.231',
    date: '2026-04-16',
    title: 'Comm Link Connected Servers & Security Fix',
    highlights: [
      'Active comm links now show which servers are connected instead of just a count',
      'Existing comm links that were not appearing on the web are now visible',
      'Comm link API endpoints are now properly secured to your organization',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Comm Links: each active comm link now lists connected servers as chips — the creator is highlighted, external servers show a truncated ID',
          'Comm Links: the invite code for each comm link is displayed as a clickable chip that copies to clipboard',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Comm Links: links created in the past were not appearing on the web settings page — a data unwrapping bug caused the list to always appear empty',
          'Comm Links: all API endpoints now verify your organization owns the comm link before allowing access, preventing cross-organization data exposure',
        ],
      },
    ],
  },
  {
    version: '2026.04.230',
    date: '2026-04-15',
    title: 'LFG Session Management, Encryption Vault Fix, Zoom Controls',
    highlights: [
      'Hosts can now start, complete, or cancel LFG sessions directly from the web',
      'The encryption vault unlock error has been resolved',
      'Scroll-wheel zoom on the Org Hierarchy and Interdiction Planner now works reliably',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LFG: hosts can start, complete, or cancel sessions from the web LFG page instead of only through Discord',
          'LFG: members can leave a session they joined using the new Leave button on the session card',
          'LFG: session cards are highlighted when you are a participant, and the list now includes open, full, and in-progress sessions',
        ],
      },
      {
        category: 'improved',
        items: [
          'LFG: the /lfg create Discord command now responds noticeably faster — settings are loaded in parallel instead of sequentially',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Encryption: unlocking the vault could fail with a JSON parsing error depending on how the key wrapper was stored \u2014 both formats are now handled correctly',
          'Encryption: users without key access were incorrectly shown the unlock prompt instead of the appropriate status',
          'Org Hierarchy: Ctrl+scroll zoom could occasionally fail and scroll the page instead of zooming the chart',
          'Interdiction Planner: scroll-wheel zoom on the system map could fail to prevent default page scrolling',
        ],
      },
    ],
  },
  {
    version: '2026.04.229',
    date: '2026-04-15',
    title: 'Moderation Timeout Detection for Large Servers',
    highlights: [
      'Timeout events are now detected reliably for all members regardless of server size',
      'Moderation incidents for timed-out users will no longer be silently missed',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          "Moderation: timeout, kick, and role-change events were silently dropped for members not in the bot's internal cache — servers with more than 200 members could miss moderation incidents entirely",
          'Moderation: the bot now receives these events for all members, so the Moderation analytics dashboard shows accurate data for organizations of any size',
        ],
      },
    ],
  },
  {
    version: '2026.04.228',
    date: '2026-04-15',
    title: 'Titles & Badges on Profiles, Comm Link Visibility Fix',
    highlights: [
      'Your profile now shows every title and badge you have earned across all organizations',
      'Badge managers can view and manage recipients directly from the badge card',
      'Comm links created from the web dashboard now appear correctly in the Active Comm Links list',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Titles & Badges: your user profile now shows a "Titles & Badges" section with every award you have received — name, type, rarity, awarding organization, and date',
          "Titles & Badges: on your own profile you can toggle each badge's visibility so only the ones you choose are shown to others",
          'Titles & Badges: badge and title cards now have a recipients button — click it to see every member who holds that award, with their avatar, name, and award date',
          'Titles & Badges: admins can revoke a badge directly from the recipients dialog without leaving the page',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Comm Links: links created from the web dashboard were not showing in the Active Comm Links list even though they existed — organization-owned links now always appear for organization members',
          'Titles & Badges: awarding or revoking a badge now immediately refreshes the recipients list instead of requiring a page reload',
        ],
      },
    ],
  },
  {
    version: '2026.04.227',
    date: '2026-04-15',
    title: 'Ship Database & Admin Improvements',
    highlights: [
      'The ship catalogue in the Admin Panel now shows all ships and lets you edit every field',
      'Ships imported by the automatic data fetcher are now visible in the admin roster and the hangar ship picker',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Admin: the Ship Roster table now shows Role, Crew, and SCU columns so you can review ship specs at a glance',
          'Admin: the ship edit form now includes Career, Vehicle Cargo, and dedicated Ship/Vehicle and Active/Inactive toggles',
          'Admin: the sub-capital size label displays cleanly instead of showing a raw underscore string',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Admin: the Ship Roster was showing an empty list — it now displays the full ship catalogue used by the hangar ship picker',
          'Ships imported by the automatic data fetcher now correctly appear as global catalogue entries',
        ],
      },
    ],
  },
  {
    version: '2026.04.226',
    date: '2026-04-15',
    title: 'External Envoys, Message Edits & Discord Reliability',
    highlights: [
      'Appoint ambassadors from organizations outside your alliance as External Envoys',
      'Edited messages in comm links are now forwarded automatically to all connected channels',
      'Member profiles now show accurate guild membership status even during brief bot outages',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Alliances: you can now appoint ambassadors from organizations outside your alliance — toggle "External Envoy" to search the full platform and grant view-only Observer access',
          'Alliances: the Discord tab now includes a full settings panel — configure auto-create org roles, role cleanup on leave, conflict resolution mode, sync notification channel, and kick non-members',
          'Comm Links: when someone edits a message in a connected channel, the edit is forwarded to all other channels automatically',
          "Discord Settings: your server's actual icon now appears on the settings page instead of a plain colored square",
          'Comm Links: links created via the /commlink create bot command are automatically tied to your organization',
        ],
      },
      {
        category: 'improved',
        items: [
          'Member Profiles: the Discord "In Guild" status is now resolved reliably in split-container deployments — previously it could show "Unknown" even when the bot was running',
          'Member Profiles: if the Discord bot is briefly offline, guild membership is inferred from recent activity data instead of showing "Unknown"',
        ],
      },
      {
        category: 'fixed',
        items: [
          "Encryption: the vault page no longer logs a 404 error in the console when you haven't registered an encryption key yet",
        ],
      },
    ],
  },
  {
    version: '2026.04.225',
    date: '2026-04-15',
    title: 'Comm Links Message Relay Improvements',
    highlights: [
      'Messages relayed between servers now show your server nickname instead of your raw username',
      'Replies include a clear quoted block so you can tell the original message from the response',
      'Stickers, rich embeds, and images are now forwarded across servers',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Comm Links: relayed messages now display your server nickname instead of your underlying username, so people see you as you appear in your own community',
          'Comm Links: the server origin label is cleaner — shown as "Nickname · Server Name" instead of the old parenthesized format',
          'Comm Links: replies show a clearly quoted block with a vertical rail so you can easily distinguish the original message from the response',
          'Comm Links: stickers are now forwarded as images — previously sticker-only messages were silently dropped',
          'Comm Links: rich embeds (bot cards, formatted messages) are now forwarded to all connected channels',
          'Comm Links: system messages like joins, pins, and server boosts are no longer relayed — only actual chat messages come through',
          'Comm Links: cross-server @everyone and @here pings are blocked for safety — only individual user mentions are allowed',
        ],
      },
    ],
  },
  {
    version: '2026.04.224',
    date: '2026-04-15',
    title: 'Voice Hub Channel Fix',
    highlights: [
      'The /voice setup hub now correctly creates temporary voice channels when users join',
      'New channels appear in the same category as the hub instead of at the server root',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Bot: the /voice setup hub was not creating temporary channels because the category was not resolved correctly — if no category was chosen during setup, channels were placed at the server root, which could fail silently',
          'Discord Bot: the hub now automatically uses the same category as the hub channel when no category is specified, so temporary channels always appear in the right place',
          'Discord Bot: the setup confirmation now shows the actual category name instead of the misleading "Same as hub" label',
        ],
      },
    ],
  },
  {
    version: '2026.04.223',
    date: '2026-04-15',
    title: 'Comm Links Dashboard Fix & Briefing Save Fix',
    highlights: [
      'Active comm links now display correctly on the Discord Dashboard',
      'All nine /commlink bot commands are documented in the help section',
      'Saving large briefings with many tactical elements no longer fails',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Briefings: saving a tactical canvas with many elements (markers, lines, tactical units, etc.) no longer fails with a server error — complex whiteboard layouts now save reliably',
          'Comm Links: active links were not showing on the Discord Dashboard — they now display all links your server created or joined',
          'Comm Links: empty state showed broken text instead of a helpful prompt',
          'Comm Links: help section referenced old /tunnel commands — updated to /commlink with all subcommands (create, join, leave, link, list, info, delete, ban, unban)',
        ],
      },
    ],
  },
  {
    version: '2026.04.222',
    date: '2026-04-15',
    title: 'Interactive Event Creation Wizard',
    highlights: [
      'Create events in Discord with a step-by-step wizard — no more cramming everything into one slash command',
      'Configure title, type, date, roles, difficulty, and more through an interactive menu',
      'The bot now respects server role restrictions when creating events',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Discord Bot: /events create now opens an interactive wizard with 11 configurable options — click buttons to set each one at your own pace',
          'Event wizard: set activity type (Event, Mission, Contract, Bounty, Operation, LFG, Job Listing), date & time, duration, location, difficulty, max participants, and role requirements',
          'Event wizard: a live checklist shows which fields are configured before you finish',
          'Event wizard: finishing automatically posts the RSVP embed with Join, Tentative, Decline, and Ship/Crew buttons',
          'Event wizard: optional voice channel creation with configurable user limit',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord Bot: event creation no longer requires memorizing slash command options — the wizard guides you through each step',
          'Discord Bot: event creation respects server role restrictions — members with banned roles cannot create events',
        ],
      },
    ],
  },
  {
    version: '2026.04.221',
    date: '2026-04-15',
    title: 'Bot State Persistence',
    highlights: [
      'Giveaways, reaction-role panels, embed templates, and voice configs now survive bot restarts',
      'Data is automatically backed up to Redis and restored on startup',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord Bot: giveaways, reaction-role panels, embed templates, and voice channel configs now persist across restarts — previously all were lost when the bot restarted',
          'Discord Bot: giveaways that expired during downtime are automatically resolved on startup',
          'Discord Bot: services are now properly initialized on startup so auto-end messages and role toggles work reliably',
        ],
      },
    ],
  },
  {
    version: '2026.04.221',
    date: '2026-04-15',
    title: 'Pyro & Nyx Maps, Zoom, and Planner in Sidebar',
    highlights: [
      'The Interdiction Planner now covers Stanton, Pyro, and Nyx — choose your system from the dropdown',
      'Zoom and pan the system map with scroll wheel or +/- buttons for precision planning',
      'The planner is now launched from the left sidebar for quicker access',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Pyro system map with all six planets, moons (Vuur, Ignis, Adir, Fairo), stations (Ruin Station, Checkmate Station), and the Pyro Belt Alpha asteroid belt',
          'Nyx system map with Delamar, Levski, Glaciem, Nyx II and Keeger, Nyx III, and the Delamar Belt',
          'System selector dropdown in the Interdiction Planner — switch between Stanton, Pyro, and Nyx instantly',
          'Zoom controls on the system map — use the scroll wheel or the +/- buttons to zoom from 50% to 400%, with a reset button to return to the default view',
          'Pan the map by holding Shift and dragging (or middle-click drag) for precision placement',
          'All location labels become visible automatically when zoomed in past 150%',
        ],
      },
      {
        category: 'improved',
        items: [
          'The Interdiction Planner is now launched from a dedicated button in the left sidebar — click any briefing to return to the tactical canvas',
          'Orbit ring data is now per-system — each map displays the correct planetary orbits for its star system',
        ],
      },
    ],
  },
  {
    version: '2026.04.220',
    date: '2026-04-14',
    title: 'Built-in Interdiction Planner & System Map',
    highlights: [
      'Plan quantum interdiction directly inside Briefings — no more external tools needed',
      'Interactive Stanton system map with all planets, moons, stations, and lagrange points',
      'Calculate the optimal QED-Snare position for multi-origin route interception',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Briefings: built-in Interdiction Planner — plan quantum interdiction without leaving the platform',
          'Interactive Stanton system map showing planets, moons, cities, orbital stations, lagrange points, and the Aaron Halo asteroid belt',
          'Click locations on the map to set multiple origins and a destination, then calculate the optimal QED-Snare placement',
          'Results show viability, interdiction coordinates, fan angle, max route distance, and per-route distance breakdown',
          'Adjustable QED effective range slider and Swap / Clear controls for quick iteration',
        ],
      },
      {
        category: 'improved',
        items: [
          'The sidebar Interdiction Planner link now opens the built-in planner instead of an external site',
          'Map Panel: the external iframe replaced with the native Interdiction Planner',
          'Stanton location data expanded with 36 locations including cities and orbital stations',
        ],
      },
    ],
  },
  {
    version: '2026.04.219',
    date: '2026-04-14',
    title: 'Image, Briefing & Alliance Fixes',
    highlights: [
      'Alliance and organization logos/banners now display correctly in the public directory',
      'Briefing tactical canvas backgrounds save reliably again',
      'Alliance settings can be saved even when logos are stored locally',
      'Discord channel lists load correctly in all deployment configurations',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Alliance HR: personnel names now display correctly — previously members without an organization title appeared as partial IDs (e.g., "473d5ac8") instead of their username',
          'Directory cards: organization and alliance logos and banners now load properly — previously they pointed to the wrong server and showed broken images',
          'Image uploads: locally-stored images now serve through the correct download endpoint instead of a missing static path',
          'Briefings: saving a tactical canvas with a background image no longer fails with a server error',
          'Briefings: the update endpoint no longer rejects valid fields or passes invalid ones to the database',
          'Alliances: saving settings with a locally-uploaded logo or banner no longer fails validation — the system now accepts both full URLs and local image paths',
          'Discord: fetching guild channels no longer fails when the bot runs in a separate container — falls back to the REST API with caching',
        ],
      },
    ],
  },
  {
    version: '2026.04.218',
    date: '2026-04-14',
    title: 'Multi-Page Briefings, Bot Simplification & Upload Fix',
    highlights: [
      'Briefings now support multiple pages — plan complex operations across separate tactical views',
      'The Discord bot is leaner with 26 focused commands — redundant commands removed',
      'Image uploads work more reliably when server-side file detection is unavailable',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Briefings: create multi-page briefings with separate tactical canvases — each page can have its own background image and element set',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord Bot: streamlined from 30 to 26 commands — /hunter, /discover, /faq, and /analytics removed in favor of existing equivalents',
          'Discord Bot: trimmed niche subcommands from /events, /announce, and /bounty to reduce clutter',
          'Bot and worker containers now run their dedicated entrypoints instead of the full Express server, reducing memory usage',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Image uploads: uploading avatars and team emblems no longer fails when the file-type detection module is unavailable',
          'FAQ: bot FAQ content loads correctly from the shared types package',
        ],
      },
    ],
  },
  {
    version: '2026.04.217',
    date: '2026-04-14',
    title: 'Ops Center Sidebar Reorganization',
    highlights: [
      'The Ops Center sidebar is now better organized — Briefings, Bounties, and Looking For Group have proper section homes',
      'Communication section moved above Ledger for faster access to the features you use most',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Ops Center sidebar: Briefings moved to the Planning section where it belongs alongside Activities, Templates, and Operations',
          'Ops Center sidebar: Bounties and Looking For Group now appear under Communication instead of floating at the bottom',
          'Ops Center sidebar: Communication section moved above Ledger for quicker access',
          'Ops Center sidebar: sections now use clean ordering (Fleet → Planning → Tracking → Communication → Ledger)',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Navigation: breadcrumbs now work correctly for hubs without a primary route at order 1',
          'Navigation: test suite updated to reflect current hub structure (5 hubs with Alliance)',
        ],
      },
    ],
  },
  {
    version: '2026.04.216',
    date: '2026-04-14',
    title: 'Federation Fleet Readiness & Treaty Sharing',
    highlights: [
      'Federation fleets now display a readiness bar showing ship and crew status at a glance',
      'Fleets shared through active diplomacy treaties automatically appear in the federation fleet list',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Federation fleets: readiness bar on each fleet card showing overall health score (green/yellow/red) with ship-ready and crew-fill percentages',
          'Federation fleets: fleets shared via active diplomacy treaties (trade, military, mutual defense, or full alliance) now appear alongside member organization fleets with a handshake icon',
          'Federation fleets: treaty type label shown on shared fleets so you can see which agreement they come from',
        ],
      },
    ],
  },
  {
    version: '2026.04.215',
    date: '2026-04-14',
    title: 'Alliance Team Management',
    highlights: [
      'Cross-org teams are now fully actionable — edit details, add or remove members, and view the full roster directly from the team card',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Alliance teams: click any team card to expand it and see the full member list with organization tags and roles',
          'Alliance teams: edit button to change name, description, type, max members, and active/disbanded status',
          'Alliance teams: add members by searching alliance personnel and assigning a role (leader, officer, or member)',
          'Alliance teams: remove individual members from the expanded member list',
        ],
      },
    ],
  },
  {
    version: '2026.04.214',
    date: '2026-04-14',
    title: 'Ambassador Picker & Changelog Fix',
    highlights: [
      'Appointing federation ambassadors is easier — pick from a list of real members instead of typing IDs',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Alliance ambassadors: the "Appoint Ambassador" dialog now shows a searchable member list from the selected organization — no more manual ID entry',
          'Members who are already ambassadors are filtered out automatically',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Changelog page: the April summary text no longer overflows its container on narrow screens',
        ],
      },
    ],
  },
  {
    version: '2026.04.213',
    date: '2026-04-14',
    title: 'Multi-Page Briefings & Image Upload',
    highlights: [
      'Briefings now support multiple pages — upload a different screenshot for each phase of your operation and annotate them individually',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Multi-page briefings — click the + button below the canvas to add pages, navigate between them with numbered chips or arrow buttons, and build a complete briefing document',
          'Each page gets its own background image and tactical elements — perfect for different mission phases, locations, or contingency plans',
        ],
      },
      {
        category: 'improved',
        items: [
          'Upload a background image (PNG, JPEG, WebP, or GIF up to 5 MB) directly from the canvas toolbar — use screenshots from VerseGuide, SnarePlan, or any other source',
          'Reference tools (VerseGuide Maps, SnarePlan, Ship Deck Maps) are now in a dedicated panel in the sidebar and open in new tabs for easier use',
          'Creating a briefing is simpler — just enter a title and classification, no mode selection needed',
          'Clearing the canvas now removes elements only on the current page, not the entire briefing',
        ],
      },
      {
        category: 'removed',
        items: [
          'The Ground / Space / Combined mode toggle has been removed — upload any image you need as the canvas background instead',
        ],
      },
    ],
  },
  {
    version: '2026.04.212',
    date: '2026-04-14',
    title: 'Bot Permission Safety & Voice Cleanup',
    highlights: [
      'The bot now checks its own permissions before acting, giving clear warnings instead of silent failures',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Bot: the bot now verifies it has the right permissions before creating voice channels, assigning welcome roles, or managing recruitment roles — and tells you what is missing if it cannot',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Voice channels: temporary voice channel deletion timers are now properly cleaned up when the bot restarts, preventing ghost cleanup attempts',
          'Federation settings: clearing optional URL fields no longer causes a type error',
        ],
      },
    ],
  },
  {
    version: '2026.04.210',
    date: '2026-04-14',
    title: 'Smart Dropdowns, Bot Enforcement & Time Limits',
    highlights: [
      'All role and channel fields now show real Discord names in dropdowns, bot commands enforce your configured settings, and applications auto-cancel if not completed in time',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Role and channel dropdowns — all 23 fields across 13 Discord Settings tabs now show real server roles and channels by name instead of manual ID entry',
          '/ticket quick-reply — send saved canned responses directly in ticket channels',
          'Application time limit — pending applications are auto-cancelled if not completed within the configured timeout',
        ],
      },
      {
        category: 'improved',
        items: [
          'Bot commands now enforce your Discord settings: ticket role gating, recruitment role restrictions and custom messages, event RSVP role gating, per-status channel routing, event archiving, voice channel positioning, LFG region/language display',
          'Recruitment accept/deny now sends custom DM messages and posts to per-status channels when configured',
          'When an applicant leaves the server, the bot can auto-withdraw their application or notify staff (configurable)',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Federation governance settings page no longer shows errors',
          'Discord Settings: application CSV export now produces proper line breaks instead of literal backslash-n characters',
          'Welcome messages: template variables like {user} and {server} are now replaced more reliably across all occurrences',
        ],
      },
    ],
  },
  {
    version: '2026.04.209',
    date: '2026-04-14',
    title: 'LFG Web Page & Unified Audit Trail',
    highlights: [
      'Find and create groups from the web with the new LFG page, and Discord audit events now flow into the same log as web events',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LFG page at /lfg — browse open groups, create LFG sessions, search by activity, join with one click. Uses the same data as the /lfg Discord command.',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord audit log events (message edits/deletes, role changes, channel changes) now write to the unified audit trail alongside web events',
        ],
      },
    ],
  },
  {
    version: '2026.04.208',
    date: '2026-04-13',
    title: 'Discord Settings — Complete Configuration Suite',
    highlights: [
      'Discord Settings expanded from 6 to 13 tabs with full configuration for every bot feature, plus personal notification preferences and competitive parity features',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Events tab — announcement channels, notification roles, RSVP behavior, reminders, cross-server mirrors, temp roles, archive channel, allowed/banned RSVP roles',
          'Notifications tab — route alerts to 5 channels, toggle join/leave/role change events, mention role lists',
          'Role Sync tab — map org ranks to Discord roles, sync intervals, verified role, manual approval, assistant roles',
          'Moderation tab — cross-server ban/mute lists, auto-ban, timeout propagation, alerts, appeals, guild whitelist',
          'Welcome tab — welcome/goodbye messages with variables, auto-role assignment, welcome DMs',
          'Audit Log tab — log message edits/deletes, role changes, channel changes, member join/leave',
          'My Preferences tab — personal DM control (LFG, events, tickets, recruitment, moderation) with timezone',
          'Server-wide timezone for event time displays',
          'Ticket quick responses with categories, satisfaction rating, channel name templates, access control',
          'Recruitment: custom messages, advanced roles, per-status channels, time limit, action on leave, CSV export',
          'Voice: 4 new interface buttons, rich naming ({nickname}/{game}/{count}), multiple hub channels, position control',
          'LFG: mute button on pings, region/language presets, role-to-filter mapping',
          'Personal Discord preferences with /notify my-status + my-toggle commands',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Discord settings now persist correctly after page reload',
          'Voice channel templates no longer disappear on refresh',
        ],
      },
    ],
  },
  {
    version: '2026.04.201',
    date: '2026-04-13',
    title: 'Discord Bot — Streamlined & Renamed',
    highlights: ['Bot trimmed from 36 to 31 commands with cleaner single-word names'],
    changes: [
      {
        category: 'improved',
        items: [
          'Removed 5 web-duplicated commands (/fleet, /org, /user, /federation, /conflicts)',
          '/tunnel → /commlink, /rsisync → /verify, /blacklist → /moderation, /attendance → /attend, /reactionrole → /roles',
          'Simplified /analytics, /wiki, /embed, /voice to essential subcommands only',
        ],
      },
      {
        category: 'removed',
        items: [
          '/fleet, /org, /user, /federation — use the web dashboard instead',
          '/conflicts — merged into /schedule conflicts and /schedule my',
        ],
      },
    ],
  },
  {
    version: '2026.04.199',
    date: '2026-04-13',
    title: 'Trading — Route Data Reliability',
    highlights: [
      'UEX trade routes no longer crash when the external price feed returns incomplete data',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'UEX Routes: the table no longer shows a blank page when a route is missing cargo availability — the SCU column now shows "N/A"',
          'Profit margin percentages display "0%" instead of "undefined%" when margin data is unavailable',
          'Adding a UEX route as an org route no longer writes "undefined%" into the route description',
        ],
      },
    ],
  },
  {
    version: '2026.04.197',
    date: '2026-04-13',
    title: 'Org Chart & Trading Stability',
    highlights: [
      'Org Chart no longer flickers when navigating between tabs',
      'Trading route creation handles edge cases more reliably',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Org Chart: the team hierarchy section no longer re-renders unnecessarily when switching tabs, reducing layout flicker',
          'Trading: creating a route when your session is in an edge state no longer silently drops your user ID',
        ],
      },
    ],
  },
  {
    version: '2026.04.196',
    date: '2026-04-13',
    title: 'Briefings — Create & Load Now Working',
    highlights: [
      'Creating and loading mission briefings now works correctly — error messages tell you exactly what went wrong instead of a generic failure',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Briefings: creating a new briefing no longer fails silently — the error banner now shows the specific reason (e.g. no organization selected, session expired, or a validation issue)',
          'Briefings: loading a selected briefing now shows a clear error message instead of falling back to the empty placeholder with no explanation',
          'Briefings: filtering briefings by tag no longer causes a server error',
          'Briefings: sorting the briefing list by title, status, classification, or date now works — previously sort options were ignored',
        ],
      },
    ],
  },
  {
    version: '2026.04.195',
    date: '2026-04-13',
    title: 'Community Members — RSI Verified Filter Fixed',
    highlights: [
      'The RSI Verified filter on the Community Members page now works correctly instead of showing a server error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Community Members: clicking the "RSI Verified" filter chip no longer returns a server error — verified members are now displayed correctly',
          'Community Members: organization badges next to each member card now load more reliably',
        ],
      },
    ],
  },
  {
    version: '2026.04.194',
    date: '2026-04-13',
    title: 'Operations — Simplified Mission Detail',
    highlights: [
      'The AI Briefing tab has been removed from the mission detail view — use the Briefings page under Ops Center for all tactical planning',
    ],
    changes: [
      {
        category: 'removed',
        items: [
          'Operations: removed the AI Briefing tab from mission details — tactical planning is handled entirely through Ops Center → Briefings',
        ],
      },
    ],
  },
  {
    version: '2026.04.193',
    date: '2026-04-13',
    title: 'Org Chart — Unified Branch Layout',
    highlights: [
      'The sub-organization hierarchy now branches out side by side just like the Divisions & Teams tree — both use the same consistent layout',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Org Chart: sub-organization groups now fan out horizontally when there are multiple at the same level, matching the Divisions & Teams layout',
          'Org Chart: the sub-org tree scrolls horizontally on narrower screens so nothing is cut off',
        ],
      },
    ],
  },
  {
    version: '2026.04.192',
    date: '2026-04-13',
    title: 'Trading — UEX Routes Now Load',
    highlights: [
      'The UEX Routes tab on the Trading page now shows live trade route data from UEX Corp instead of an empty list',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Trading: UEX trade routes, terminals, and commodity lookups now return data — previously the page always said "No trade routes found" because the price feed connection was not configured',
          'Trading: setting the minimum margin filter to 0% now works correctly — previously any value of 0 was ignored and treated as 5%',
          'Trading: entering invalid text in the margin filter no longer breaks the search — it falls back to the default',
        ],
      },
    ],
  },
  {
    version: '2026.04.191',
    date: '2026-04-13',
    title: 'Award Badge — Member Picker',
    highlights: [
      'Awarding badges and titles now shows a searchable member list instead of requiring a user ID',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Award Badge: the dialog now presents a searchable dropdown of your organization members with avatars and display names',
          'Award Badge: the member list loads only when you open the dialog, keeping page load fast',
        ],
      },
    ],
  },
  {
    version: '2026.04.189',
    date: '2026-04-13',
    title: 'Org Hierarchy — Parallel Branch Layout',
    highlights: [
      'The Divisions & Teams chart now shows sibling teams side by side instead of stacked in a single column — giving a true org-chart layout',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Org Hierarchy: sibling teams now fan out horizontally from their parent with connecting lines, making multi-branch structures much easier to read',
          'Org Hierarchy: single-child branches stay compact with a simple vertical connector',
          'Org Hierarchy: the chart scrolls horizontally on narrower screens so no branches are cut off',
        ],
      },
    ],
  },
  {
    version: '2026.04.187',
    date: '2026-04-13',
    title: 'Treasury & Inventory — Now Working',
    highlights: [
      'Treasury and Inventory pages now load correctly instead of showing a server error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Treasury: balance, transactions, statistics, and leaderboard now load instead of returning a 500 error',
          'Inventory: item list and market price lookups now work correctly',
        ],
      },
    ],
  },
  {
    version: '2026.04.186',
    date: '2026-04-13',
    title: 'Org Hierarchy — Custom Roles & Team Divisions',
    highlights: [
      'Custom roles now appear as their own tier in the Org Hierarchy chart instead of being lumped under "Other"',
      'If your org has teams, a new Divisions & Teams section shows everyone grouped by their team assignments',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Org Hierarchy: each custom role is now shown as a named, color-coded tier with its description and a "Custom" badge',
          'Org Hierarchy: custom roles are sorted by priority — higher-priority roles appear higher in the chart',
          'Org Hierarchy: new "Divisions & Teams" section below the role tiers shows your team hierarchy with member assignments',
          'Org Hierarchy: team leaders and officers are annotated with their team role in parentheses',
          'Org Hierarchy: the legend now includes custom role names alongside built-in roles',
        ],
      },
    ],
  },
  {
    version: '2026.04.185',
    date: '2026-04-13',
    title: 'Community Members — Filters Now Work',
    highlights: [
      'The RSI Verified and Has Organization filter chips on the Community Members page now actually filter results when clicked',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Community Members: clicking the "RSI Verified" or "Has Organization" filter chip now filters the list correctly — previously clicking either chip had no visible effect',
          'Community Members: the search bar stretches to fill available width on wider screens',
          'Community Members: the result count now appears inline with the filter chips instead of on a separate line',
        ],
      },
    ],
  },
  {
    version: '2026.04.184',
    date: '2026-04-13',
    title: 'Briefings — Combined Arms, Ship Deck Maps & Canvas Fix',
    highlights: [
      'New Combined Arms mode shows ground maps, space interdiction tools, and ship deck plans side by side for multi-domain operations',
      'Ship Deck Maps from maps.adi.sc are now built in — plan boarding ops against specific ships right inside your briefing',
      'Placing markers, arrows, lines, and tactical units on the canvas now works correctly',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Briefings: new Combined Arms mode — shows VerseGuide terrain map, SnarePlan interdiction calculator, and Ship Deck Maps all at once for ops that span ground and space',
          'Briefings: Ship Deck Maps panel embeds interactive 3D ship layouts from maps.adi.sc — browse deck plans to plan boarding or ship defense. Available in Space and Combined modes',
          'Briefings: open ship maps in a full-screen tab with the Open Full button',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Briefings: placing markers, lines, arrows, text labels, and tactical units on the canvas now works — previously every element was silently rejected by the server',
          'Briefings: when loading a selected briefing fails, an error message is now visible instead of showing a blank panel',
          'Briefings: fetching briefings for a specific mission no longer fails due to a route conflict',
        ],
      },
    ],
  },
  {
    version: '2026.04.183',
    date: '2026-04-13',
    title: 'Sidebar Ledger Section & Icon Refresh',
    highlights: [
      'Trading, Inventory, and Treasury are now grouped under a new Ledger section in the Ops Center sidebar',
      'Discord features now show the official Discord logo throughout the app',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Ops Center: Trading, Inventory, and Treasury are grouped under a new "Ledger" section in the sidebar so financial and logistics tools are easier to find',
          'Trading: icon updated from a trend line to a storefront for quicker recognition',
          'Inventory: icon updated from a generic folder to a package icon',
          'Treasury: icon updated from a wallet to a bank building — the previous icon was not rendering correctly',
          'Discord Integration, Bot Commands, and Bot Statistics now display the official Discord logo instead of generic icons',
        ],
      },
    ],
  },
  {
    version: '2026.04.182',
    date: '2026-04-13',
    title: 'Team & Fleet Emblems',
    highlights: [
      'Give your teams a custom emblem — it automatically syncs to any linked fleet so your branding stays consistent',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Teams: set a custom emblem (logo image) when creating or editing a team — upload an image first, then paste the URL',
          "Fleets: when you update a team's emblem, every fleet linked to that team picks up the new logo automatically",
          'Fleets: creating a fleet with an emblem copies it to the auto-created crew team so both stay in sync from day one',
        ],
      },
    ],
  },
  {
    version: '2026.04.181',
    date: '2026-04-13',
    title: 'Briefings Security & Trading Stability',
    highlights: [
      'Briefings are now protected against a class of request tampering via input sanitization',
      'Trading page type errors resolved for smoother navigation and fewer console warnings',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Briefings: creating a briefing now sanitizes the request body to prevent injection of unexpected fields',
          'Trading: fixed a type mismatch that could cause the route search to fail under certain filter combinations',
          'Trading: theme colours on the trading page now resolve correctly in all MUI themes',
          'Treasury: commissary purchase checks use cleaner optional-chain syntax for reliability',
        ],
      },
    ],
  },
  {
    version: '2026.04.180',
    date: '2026-04-13',
    title: 'Briefings — Intel Classification, Operations & Map Modes',
    highlights: [
      'Briefings now have intel classification levels to control who can view sensitive plans',
      'Link briefings to one or more operations so your team knows which plans go with which mission',
      'Choose Ground Ops or Space mode to get the right map tool — VerseGuide for planetary ops, SnarePlan for interdiction',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Briefings: set an intel classification (Public, Restricted, Confidential, Secret, or Top Secret) on every briefing — controls visibility and shows a color-coded badge',
          'Briefings: link a briefing to one or more operations from the right panel — search and pick your active operations',
          'Briefings: new Ground Ops / Space mode — Ground Ops shows the VerseGuide map with planet and location picker, Space shows the SnarePlan quantum interdiction calculator',
          'Briefings: mode is saved per-briefing and shown in the list with a Ground or Space chip',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Invitations: sending an invitation to join your organization no longer fails with a "Bad Request" error',
          'Briefings: clearing all elements from the canvas now works — previously the elements were silently ignored',
        ],
      },
    ],
  },
  {
    version: '2026.04.179',
    date: '2026-04-12',
    title: 'Navigation Improvements & Admin Data Export',
    highlights: [
      'Navigation sidebar and command palette updated with better organization and keyboard shortcuts',
      'Admin portal now has data export and obfuscation tools for compliance',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Navigation: command palette and sidebar reorganized with clearer section groupings',
          'Navigation: keyboard shortcuts work more consistently across all pages',
          'Admin: data obfuscation service for GDPR-compliant data exports',
          'Admin: ship management operations improved with delta update support',
        ],
      },
    ],
  },
  {
    version: '2026.04.178',
    date: '2026-04-12',
    title: 'API Keys — Connect External Tools',
    highlights: [
      'You can now create API keys to connect tools like Wingman AI to your Fringe Core account',
      'Choose exactly what each key can access with fine-grained permissions',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Settings: new API Keys tab lets you create, view, and revoke API keys',
          'Each key has a name, permission scopes, and an optional expiration date',
          'Available scopes: Read Profile, Read Fleet, Read Activities, Write Activities, or Full Access',
          'Keys are shown only once when created — copy it before closing the dialog',
          'Revoke any key instantly if it is compromised or no longer needed',
          'Up to 10 active keys per account',
        ],
      },
    ],
  },
  {
    version: '2026.04.177',
    date: '2026-04-12',
    title: 'Profile — Organizations, Ranks & Richer Profiles',
    highlights: [
      'Your profile now shows every organization you belong to and your rank in each',
      'Other users see much more on your profile — bio, RSI verification, org memberships, and more',
      'New privacy toggle lets you choose whether to show your organizations publicly',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Profile: new Organizations section displays all your orgs with your rank in each',
          'Privacy: new "Organizations & Ranks" toggle in Settings > Privacy & Data — controls whether others can see your org memberships (shown by default)',
          'Community cards: the member directory cards now respect the organizations privacy toggle',
        ],
      },
      {
        category: 'improved',
        items: [
          "Profile: visiting another user's profile now shows their full public info — bio, RSI handle, verified badge, organizations, ships, activity, and trust score — instead of just name and join date",
          'Profile: your own profile now loads your organizations in a single request instead of separately',
          'Profile: public profiles now show last-active date',
        ],
      },
    ],
  },
  {
    version: '2026.04.176',
    date: '2026-04-12',
    title: 'Admin Portal — Scheduled Job Controls',
    highlights: [
      'Admins can now enable, disable, and manually trigger background jobs from the Operations tab',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Admin Portal: the Operations tab now lists all 12 background jobs with their schedule, health status, success rate, and last run time',
          'Admin Portal: each job has an on/off toggle to enable or disable it — disabled jobs skip their next scheduled run',
          'Admin Portal: each job has a Run button to manually trigger it immediately — useful for forcing a data refresh without waiting',
          'Admin Portal: jobs that take longer than 30 seconds return a "running in background" status so the page stays responsive',
        ],
      },
    ],
  },
  {
    version: '2026.04.175',
    date: '2026-04-12',
    title: 'Keyboard Shortcuts — Smarter Navigation',
    highlights: [
      'The command palette and keyboard shortcuts now respect your access level — you only see pages you can actually visit',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Keyboard shortcut 4 now opens the Community Directories page instead of the admin-only User Management page',
          'Command palette (Ctrl+K) no longer shows admin pages, organization-restricted pages, or role-restricted pages you cannot access',
          'Number key shortcuts (1-4) no longer trigger when typing in textareas, dropdowns, or rich text editors',
        ],
      },
    ],
  },
  {
    version: '2026.04.174',
    date: '2026-04-12',
    title: 'Admin Portal — Usernames Now Visible',
    highlights: [
      'Admins can now see usernames and user IDs when managing accounts, making it easier to provide support',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Admin Portal: usernames, display names, and user IDs are now visible so admins can identify who they are helping',
          'Admin Portal: email addresses remain partially masked for privacy (e.g., j***n@example.com)',
          'Admin Portal: passwords, tokens, and user-generated content stay fully protected',
          'Admin Portal: all admin actions continue to be audit-logged',
        ],
      },
    ],
  },
  {
    version: '2026.04.173',
    date: '2026-04-12',
    title: 'Admin Ship Catalog — Fixed',
    highlights: [
      'The Admin ship catalog page now loads correctly instead of showing a server error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Admin Ship Catalog: the ship list, search, and filters now load instead of returning a 500 error',
          'Admin Ship Catalog: viewing, creating, editing, and deleting individual ships works again',
          'Admin Ship Catalog: CSV import preview and apply operations now find catalog ships correctly',
        ],
      },
    ],
  },
  {
    version: '2026.04.172',
    date: '2026-04-12',
    title: 'Briefings Org Scoping & Help Center',
    highlights: [
      'Briefings are now properly scoped to your organization',
      'Help Center navigation improved with consistent search and categorized FAQ sections',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Briefings: now correctly scoped to your organization — previously all briefings were shared globally',
          'Bounty routes: public bounty listing now works correctly',
        ],
      },
      {
        category: 'improved',
        items: [
          'Help Center: updated FAQ content and improved navigation',
          'Navigation: sidebar links updated for better discoverability',
        ],
      },
    ],
  },
  {
    version: '2026.04.171',
    date: '2026-04-12',
    title: 'Trading Routes — Route List & Analytics Fixed',
    highlights: [
      'The Trading routes page now loads your routes instead of showing a server error',
      'Creating, editing, and deleting trade routes works correctly again',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          "Trading: the routes page now loads your organization's trade routes instead of returning a 500 error",
          'Trading: creating a new route now correctly records the creator and organization — previously both were set to the organization ID',
          'Trading: editing, deleting, and viewing individual routes now works with the correct ownership check',
          'Trading: organization analytics now pull the correct routes',
        ],
      },
    ],
  },
  {
    version: '2026.04.170',
    date: '2026-04-12',
    title: 'Briefings — Creating & Loading Now Works',
    highlights: [
      'The Briefings page now loads your briefing list correctly',
      'Creating a new briefing no longer fails with a server error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Briefings: the briefing list now loads instead of returning a 500 error — the database was missing a required column for organization-scoped queries',
          'Briefings: creating a briefing no longer fails — new briefings are now initialized with an empty canvas by default',
        ],
      },
    ],
  },
  {
    version: '2026.04.169',
    date: '2026-04-12',
    title: 'Bounty Claims — My Claims & Pending Lists Fixed',
    highlights: [
      'The "My Claims" and "Pending Claims" pages now load correctly instead of showing an error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Bounty claims: the "My Claims" page no longer returns a "Bad Request" error when filtering by status — active, submitted, completed, abandoned, and rejected filters all work correctly now',
          'Bounty claims: the "Pending Claims" page now loads your pending approvals instead of showing an error',
        ],
      },
    ],
  },
  {
    version: '2026.04.168',
    date: '2026-04-12',
    title: 'Landing Page Redesign & Onboarding',
    highlights: [
      'The landing page has been redesigned with a new hero section, feature showcase, and Discord bot preview',
      'New onboarding flow guides first-time users through setup',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Landing page: completely redesigned with a modern hero section, animated feature showcase cards, and a Discord bot commands preview',
          'Onboarding: new guided setup walkthrough for first-time users to configure their organization',
          'Changelog page: improved layout and readability',
          'Public stats page: cleaner presentation of platform statistics',
          'Bot FAQ: updated content for latest features',
        ],
      },
    ],
  },
  {
    version: '2026.04.167',
    date: '2026-04-12',
    title: 'Price Alerts & Briefings Now Load',
    highlights: [
      'The Trading price alerts page no longer shows a server error',
      'The Briefings page now loads correctly',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Trading: the price alerts page now loads instead of returning a 500 error — a missing database table has been created',
          'Briefings: the page now loads instead of returning a 500 error — the API route was disabled and has been re-enabled',
        ],
      },
    ],
  },
  {
    version: '2026.04.166',
    date: '2026-04-12',
    title: 'Invite Member — User Search',
    highlights: [
      'Inviting a member to your organization now uses a search-as-you-type user picker instead of requiring you to know their user ID',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Invite Member: the invite dialog now lets you search for users by name or username — start typing and pick from the dropdown instead of pasting a user ID',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Invite Member: sending an invitation no longer fails with a "Bad Request" error when you type a username instead of a UUID',
        ],
      },
    ],
  },
  {
    version: '2026.04.165',
    date: '2026-04-12',
    title: 'Platform Branding & Help Center Update',
    highlights: [
      'All user-facing descriptions now use the Fringe Core brand name consistently',
      'The landing page hero and feature cards updated to reflect everything the platform offers today',
      'Help Center FAQ answers rewritten to cover bounties, tactical briefings, trading, moderation, alliances, and badges',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Dashboard: welcome message now reads "Welcome to Fringe Core" instead of "Star Citizen Fleet Manager"',
          'Landing page: hero subtitle and description updated to mention bounties, trade routes, tactical briefings, and operations',
          'Feature showcase: all eight feature cards refreshed with current capabilities like fleet repair/refuel tracking, org hierarchy, tactical briefings, live UEX Corp pricing, and SCStats integration',
          'Discord bot preview: updated from "33 commands" to "35+ slash commands across 7 domains" including moderation',
          'Help Center: "What is Fringe Core?" rewritten to describe the full platform scope',
          'Onboarding tour: welcome and completion steps now use Fringe Core branding',
        ],
      },
    ],
  },
  {
    version: '2026.04.163',
    date: '2026-04-12',
    title: 'Bounty Hunter & Claims Fixes',
    highlights: [
      'The Bounty Hunter Profile page now loads your stats, rank, and specializations correctly',
      'The My Claims tab in Bounties now shows your active claims instead of an error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Bounty Hunter Profile: your stats, rank, leaderboard, history, and analytics tabs now load correctly instead of showing "data is undefined"',
          'My Claims: viewing your active, submitted, and completed bounty claims now works — previously the page showed an error or blank content',
          'Bounty details, claim approvals, evidence submission, and pending reviews now all load and save reliably',
        ],
      },
    ],
  },
  {
    version: '2026.04.162',
    date: '2026-04-12',
    title: 'Titles & Badges — Icon Upload',
    highlights: [
      'You can now upload a custom icon image when creating or editing a badge instead of pasting a URL',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Titles & Badges: new "Upload Icon" button lets you upload an image directly from your computer (PNG, JPEG, WebP, or GIF up to 5 MB) — the uploaded image is stored securely and its URL is filled in automatically',
          'Titles & Badges: a live preview of the badge icon is shown next to the upload button so you can see what it looks like before saving',
          'Titles & Badges: a remove button on the icon preview lets you clear the icon with one click',
        ],
      },
      {
        category: 'improved',
        items: [
          'Titles & Badges: you can still paste an icon URL manually if you prefer — upload and URL entry work together seamlessly',
        ],
      },
    ],
  },
  {
    version: '2026.04.161',
    date: '2026-04-12',
    title: 'Profile Avatar Upload Fix',
    highlights: [
      'Uploading a custom profile picture now works — your avatar is no longer broken after upload',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Profile: uploading a custom avatar no longer results in a broken image — uploaded pictures now display correctly everywhere on the platform',
        ],
      },
    ],
  },
  {
    version: '2026.04.160',
    date: '2026-04-12',
    title: 'Cookie Security & Moderation Fixes',
    highlights: [
      'Authentication cookies are now more secure with stricter SameSite settings',
      'Moderation analytics pages now load correctly instead of showing errors',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Authentication: cookies now use SameSite=Lax (stricter than None) for better CSRF protection while still supporting normal navigation',
          'Logout: CSRF token cookie is now properly cleared alongside access and refresh tokens',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Moderation: analytics, repeat offenders, and statistics pages now load correctly instead of failing with response format errors',
          'Admin ship manager: pagination data now parsed correctly from API response',
          'Organization deletion preview: response data now extracted correctly',
        ],
      },
    ],
  },
  {
    version: '2026.04.159',
    date: '2026-04-12',
    title: 'Personal Hangar — Improved Security & Reliability',
    highlights: [
      'Ship list sorting is now validated to prevent unexpected behavior',
      'Ship search results now consistently show production status labels',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Personal Hangar: sort options are now validated — only recognized ship fields (name, status, condition, date, etc.) are accepted, making sorting more reliable',
          'Personal Hangar: ship search results now consistently show production status labels (Flight Ready, In Concept, etc.) on every ship',
        ],
      },
    ],
  },
  {
    version: '2026.04.158',
    date: '2026-04-12',
    title: 'Admin Portal Data Fixes',
    highlights: [
      'Several Admin Portal tabs that showed placeholder data or errors now display real live data',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Operations Monitor: the page no longer shows "Failed to load" — Discord bot stats, scheduled jobs, and data fetcher statuses now load correctly',
          'Legal Holds: the page was showing sample data instead of your actual legal holds — it now shows real information',
          'Discord Settings: opening the settings page no longer shows "Discord settings not found" — your guild configuration now loads and saves correctly',
          'GDPR Compliance: consent statistics were showing sample numbers — the tab now shows real consent and data request counts',
        ],
      },
    ],
  },
  {
    version: '2026.04.157',
    date: '2026-04-12',
    title: 'Org Hierarchy Page',
    highlights: ['The organization chart now has its own page in the sidebar under Members'],
    changes: [
      {
        category: 'added',
        items: [
          "Org Hierarchy: a dedicated page for viewing your organization's structure — accessible from the Members section in the sidebar instead of being tucked inside Org Settings",
          'Org Hierarchy: shows divisions, departments, teams, and member role tiers at a glance',
        ],
      },
    ],
  },
  {
    version: '2026.04.156',
    date: '2026-04-12',
    title: 'Fleet Role Filter Fix',
    highlights: ['The role filter on the Organization Ships page no longer causes an error'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Organization Ships: selecting a role filter (e.g. "Bomber", "Fighter") no longer shows an error — the filter now works correctly',
        ],
      },
    ],
  },
  {
    version: '2026.04.155',
    date: '2026-04-12',
    title: 'Community Members — Filters & Organization Info',
    highlights: [
      'Member cards now show which organizations each person belongs to',
      'New filter chips let you narrow the directory to RSI-verified members or members with an organization',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Community Members: each member card now shows public organization memberships — org name, logo, and role (e.g. Admin, Officer) — up to two per card with a "+N more" overflow',
          'Community Members: RSI handle is now always shown as a styled badge on cards, making it easier to find members by their Star Citizen identity',
          'Community Members: search now finds members by RSI handle in addition to name and username',
          'Community Members: new "RSI Verified" and "Has Organization" filter chips below the search bar let you narrow results quickly',
          'Community Members: a "Clear All" chip appears when any filter or search is active, resetting everything in one click',
        ],
      },
    ],
  },
  {
    version: '2026.04.154',
    date: '2026-04-12',
    title: 'Logout Fix',
    highlights: [
      'Logging out now works correctly — your session is fully cleared and you stay signed out',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Logout: clicking "Log Out" no longer leaves you signed in — the session is now fully cleared on both the server and your browser',
          'Logout: the CSRF security token is now also cleared when you log out, closing a defense-in-depth gap',
        ],
      },
    ],
  },
  {
    version: '2026.04.153',
    date: '2026-04-12',
    title: 'Data Loading Fixes Across the Platform',
    highlights: [
      'Fixed 20 places where pages showed loading spinners forever or displayed blank data',
      'Moderation, Admin Metrics, CAS Scores, Crew Assignments, Discord Tunnels, and more all load correctly now',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Admin Metrics: the system metrics dashboard and charts (Active Users, Error Trend) no longer show an infinite loading spinner — real data appears as expected',
          'Moderation: viewing, creating, updating, revoking, and sharing incidents now works correctly — previously all incident actions showed no result',
          'Moderation: the User Lookup, Analytics, Repeat Offenders, and Sharing Config sections now load data instead of showing blanks',
          'CAS Scores: the score history chart and organization ranking table now display data correctly',
          'Crew Assignments: creating a new crew assignment now shows the saved result — previously the assignment was created but the page did not update',
          'Discord Tunnels: creating or updating a Jump Point tunnel now shows the updated tunnel immediately instead of requiring a page refresh',
          'Admin Ship Manager: the ship catalog table, search, filters, and pagination now work correctly — previously the table appeared empty',
          'Organization Deletion: the deletion confirmation dialog now shows the data count preview instead of showing an error',
        ],
      },
    ],
  },
  {
    version: '2026.04.152',
    date: '2026-04-12',
    title: 'Personal Hangar — Filters & Search Fixed',
    highlights: [
      'The Status and Condition filter dropdowns in Personal Hangar now correctly filter your ship list',
      'The search bar now finds ships by name, custom name, description, or notes',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Personal Hangar: the Status filter (Owned, Pledged, Loaned, Gifted) now filters your ships correctly — previously selecting a status had no effect',
          'Personal Hangar: the Condition filter (Pristine, Excellent, Good, Fair, Poor, Damaged, Critical) now filters your ships correctly',
          'Personal Hangar: the search bar now finds ships by name, custom name, description, or notes — previously typing in the search box did nothing',
        ],
      },
    ],
  },
  {
    version: '2026.04.151',
    date: '2026-04-12',
    title: 'Hunter Profile Error Improvements',
    highlights: [
      'The Bounty Hunter Profile page now shows helpful error messages and lets you retry without refreshing',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Bounty Hunter Profile: error messages now tell you exactly what went wrong instead of a generic failure notice',
          'Bounty Hunter Profile: if no organization is selected, the page now tells you to pick one instead of showing a confusing error',
          'Bounty Hunter Profile: added a Retry button so you can try again without refreshing the page',
        ],
      },
    ],
  },
  {
    version: '2026.04.150',
    date: '2026-04-12',
    title: 'Titles & Badges — Settings Toggle & New Icon',
    highlights: [
      'You can now enable or disable Titles & Badges directly from Organization Settings',
      'Titles & Badges has a new medal icon in the sidebar for easier recognition',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Organization Settings: a new "Titles & Badges" toggle in the Feature Toggles section lets admins turn the feature on or off without leaving the settings page',
        ],
      },
      {
        category: 'improved',
        items: [
          'Titles & Badges now uses a medal icon in the sidebar instead of the previous generic icon, making it easier to spot at a glance',
        ],
      },
    ],
  },
  {
    version: '2026.04.149',
    date: '2026-04-12',
    title: 'Chart Display Fix',
    highlights: [
      'Charts across the platform no longer flash console warnings or render with zero dimensions on first load',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Charts: pie charts, bar charts, line charts, and area charts on the Dashboard, Fleet Operations, Personal Hangar, Organization Relations, Bot Stats, Cross-System Analytics, and Admin dashboards no longer briefly render with invalid dimensions on initial page load',
        ],
      },
    ],
  },
  {
    version: '2026.04.148',
    date: '2026-04-12',
    title: 'Admin Operations Monitor & Ship Catalog Fix',
    highlights: [
      'New Operations Monitor tab in the Admin Portal for managing ship catalog operations, cache, and system health',
      'Ship catalog pages no longer fail with a 500 error when the database was missing soft-delete columns',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Admin Portal: new Operations Monitor tab — trigger ship data syncs, clear caches, view sync history, and monitor system health from one central dashboard',
          'Admin Portal: performance dashboard redesigned with tabbed layout (Overview, Resources, Queries, Trends) for better organization',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Ship catalog: pages that list ships no longer return 500 errors — the database was missing required columns for soft-delete filtering',
          'Feature flags: admin flags panel rendering fixed',
        ],
      },
    ],
  },
  {
    version: '2026.04.147',
    date: '2026-04-12',
    title: 'GDPR Compliance — Live Data',
    highlights: [
      'The GDPR Compliance tab in the Admin Portal now shows real data export and deletion requests from the database',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'GDPR Compliance: summary cards now show live counts of export requests, deletion requests, and pending requests instead of placeholder numbers',
          'GDPR Compliance: the Recent GDPR Requests table lists actual requests across all users — with type, status, request date, and completion date',
          'GDPR Compliance: user identifiers are anonymized in the admin view for privacy (only last four characters shown)',
        ],
      },
    ],
  },
  {
    version: '2026.04.146',
    date: '2026-04-12',
    title: 'Admin Metrics Now Show Live Data',
    highlights: [
      'Charts and metric cards in the Admin Portal now display real data instead of placeholders',
      'Cache hit rate, response time, query count, and error rate are all live',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Admin Metrics: the Active Users and Error Trend charts now show real daily data from the database instead of random placeholder values',
          'Admin Metrics: Activities by Type and Activities by Status tables were always empty — they now show actual breakdowns of your activities',
          'Admin Metrics: Cache Hit Rate, Avg Response Time, Queries, and Error Rate now pull from live monitoring services instead of hardcoded placeholder numbers',
          'Admin Metrics: Cache Hit Rate no longer displays an impossible 8750% — the value is now calculated and formatted correctly',
          'Admin Metrics: metric cards no longer appear blank on load — data is now read correctly from the server response',
        ],
      },
    ],
  },
  {
    version: '2026.04.145',
    date: '2026-04-12',
    title: 'Performance Dashboard Redesign',
    highlights: [
      'The admin Performance Dashboard now auto-refreshes every 30 seconds with a live indicator',
      'New frosted-glass metric cards with color-coded health bars and responsive layout',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Performance Dashboard: redesigned metric cards with status colors, hover effects, and distribution bars so you can see health at a glance',
          'Performance Dashboard: new "Live" toggle auto-refreshes stats every 30 seconds — a progress bar at the top shows when data is loading',
          'Performance Dashboard: trend chart upgraded to a filled area chart with gradient shading for easier reading',
          'Performance Dashboard: all charts now adapt to dark and light mode — no more hard-to-read labels on dark backgrounds',
          'Performance Dashboard: budget section now includes a progress bar showing how close each metric is to its threshold',
          'Performance Dashboard: responsive layout — 4 metric columns on desktop, 2 on tablet, 1 on mobile',
        ],
      },
    ],
  },
  {
    version: '2026.04.144',
    date: '2026-04-12',
    title: 'Admin User Management Fix',
    highlights: ['Searching for users in the Admin Portal now shows results correctly'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Admin User Management: search results no longer appear blank or crash — all user fields (email, username, role, organization, status) now display correctly',
        ],
      },
    ],
  },
  {
    version: '2026.04.143',
    date: '2026-04-12',
    title: 'Admin Operations Monitor',
    highlights: [
      'New Operations tab in the admin portal: see Discord bot command health, scheduled job statuses, and data fetcher results in one view',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Admin Portal: new Operations tab showing Discord bot command success rates, per-command breakdown, and recent error details',
          'Admin Portal: scheduled jobs section with health indicators, success-rate bars, execution counts, and last-run info including error messages',
          'Admin Portal: data fetchers section for Ship Data and Regolith fetchers — shows run status, staleness, and source-level error details',
          'All three sections auto-refresh every 30 seconds and degrade gracefully if a subsystem is offline',
        ],
      },
    ],
  },
  {
    version: '2026.04.142',
    date: '2026-04-12',
    title: 'Admin Ship Dashboard Fix',
    highlights: ['The Ship Management page in the Admin portal now loads correctly'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Admin Ship Management: the page showed a server error instead of loading the ship catalog — this has been fixed and the ship list, search, and filters now work as expected',
        ],
      },
    ],
  },
  {
    version: '2026.04.141',
    date: '2026-04-12',
    title: 'Feature Flag Usability',
    highlights: [
      'Creating a feature flag now auto-generates the Feature ID from the name you type',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Feature Flags: the Feature ID is now generated automatically when you type a name — for example "AI Mission Planning" becomes ai-mission-planning — so you no longer need to craft the ID manually',
          'Feature Flags: the Name field is now first in the form so you start with the human-readable name and the technical ID fills in for you',
        ],
      },
    ],
  },
  {
    version: '2026.04.139',
    date: '2026-04-11',
    title: 'Bounty & Briefing Fixes',
    highlights: [
      'Bounty claims are now properly scoped to your organization',
      'Notes fields no longer reject empty values',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Bounty claims: pending and my-claims lists now only show claims from your current organization — previously claims from other organizations could appear',
          'Briefings: the page now loads correctly after a routing fix',
          'Notes fields across the platform now accept empty values without showing an error',
        ],
      },
    ],
  },
  {
    version: '2026.04.138',
    date: '2026-04-11',
    title: 'Member Audit Discord Fix',
    highlights: [
      'Member Audit profile now shows accurate Discord guild status, roles, and join date',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Member Audit: the profile drawer showed "Not in guild" and missing Discord info even when the member was in the Discord server — now correctly displays guild membership, roles, display name, join date, and online status',
        ],
      },
    ],
  },
  {
    version: '2026.04.137',
    date: '2026-04-11',
    title: 'Operations Fixes',
    highlights: [
      'Creating operations now works correctly',
      'Sort controls on the Operations page are no longer stuck on default order',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Operations: creating a new operation no longer shows a validation error — the form now submits successfully even when optional fields like Notes are left blank',
          'Operations: changing the Sort By dropdown or toggling ascending/descending now actually reorders the list instead of being silently ignored',
        ],
      },
    ],
  },
  {
    version: '2026.04.136',
    date: '2026-04-11',
    title: 'Community Members Directory Fix',
    highlights: ['The Members directory now loads reliably for all users'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Community Members directory: browsing members no longer shows a server error — the page now works even when some user profiles have unusual privacy settings',
        ],
      },
    ],
  },
  {
    version: '2026.04.135',
    date: '2026-04-11',
    title: 'Bounty Claims Fix',
    highlights: ['Bounty claim pages now load correctly'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Bounty Claims: "Failed to fetch claims" error resolved — the My Claims and Pending Claims pages now load correctly',
        ],
      },
    ],
  },
  {
    version: '2026.04.133',
    date: '2026-04-11',
    title: 'Better Online Counts & Bug Fixes',
    highlights: [
      'Dashboard online member count now includes Discord presence',
      'Community Members directory and Bounty Hunter Profile pages load correctly',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Dashboard online count now shows Discord members who are online, idle, or DND — not just users with the site open',
          'Discord Bot /faq command now includes a Titles & Badges section',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Community Members directory: "Failed to load community members" error resolved — the page now handles profiles with missing privacy preferences',
          'Bounty Hunter Profile: "Failed to load hunter profile" error resolved — the database table was missing in production',
        ],
      },
    ],
  },
  {
    version: '2026.04.132',
    date: '2026-04-11',
    title: 'Org Chart Moved to Members',
    highlights: ['The Org Chart is now in Members & Permissions for easier access'],
    changes: [
      {
        category: 'improved',
        items: [
          'Org Chart tab moved from Organization Settings to Members & Permissions — find it right next to your member roster, roles, and permissions',
        ],
      },
    ],
  },
  {
    version: '2026.04.132',
    date: '2026-04-11',
    title: 'Sidebar Navigation Fix',
    highlights: [
      'Briefings, Bounties, and Trading are now visible in the Ops Center sidebar',
      'Moderation is now visible in the Organization sidebar',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Ops Center sidebar: Briefings, Bounties, and Trading were missing — they now appear below the grouped sections (Fleet, Planning, Communication, Tracking)',
          'Organization sidebar: Moderation was missing — it now appears below the grouped sections (Members, Intel, Management)',
          'Collapsed sidebar (icon-only mode) and mobile drawer also fixed — all sidebar modes now show the same items',
        ],
      },
    ],
  },
  {
    version: '2026.04.131',
    date: '2026-04-11',
    title: 'Tactical Briefings, Maps & Interdiction Planning',
    highlights: [
      'Plan operations on a tactical whiteboard with fleet formation icons',
      'Browse Stanton and Pyro locations with embedded VerseGuide maps',
      'Plan quantum interdiction routes with the built-in SnarePlan tool',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Mission Briefings — new page in Ops Center for planning operations on a tactical canvas',
          'Tactical fleet icons — place NATO-style unit symbols for fighters, bombers, scouts, transports, capital ships, support, mining, and salvage',
          'Five formation sizes: Element (2 ships), Flight (4), Platoon (8-12), Squadron (16-24), Fleet (24+)',
          'VerseGuide map integration — browse planets, moons, and lagrange points in Stanton and Pyro directly in your briefing',
          'SnarePlan interdiction planner — calculate optimal QED-Snare positions from origin to destination',
          'Drawing tools — markers, text labels, lines, arrows, and shapes on the briefing canvas',
          'Briefing versioning — create snapshots to track changes over time',
        ],
      },
      {
        category: 'improved',
        items: ['About page now lists VerseGuide and SnarePlan as supported integrations'],
      },
    ],
  },
  {
    version: '2026.04.130',
    date: '2026-04-11',
    title: 'Custom Titles & Badges',
    highlights: [
      'Create custom badges and titles to recognize your organization members',
      'Five rarity tiers from Common to Legendary — award badges that stand out',
      'Members choose which badges appear on their profile',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Titles & Badges — create custom badges and titles from the Organization sidebar to recognize members for contributions, skills, and milestones',
          'Five rarity tiers: Common, Uncommon, Rare, Epic, and Legendary — each with a distinct color',
          'Badge categories — organize badges into groups like leadership, combat, or exploration',
          'Award & revoke — give badges to members or remove them with one click',
          'Profile display control — members choose which badges are visible and in what order',
          'Filter and browse — search your badge library by type, rarity, or category',
          'Audit trail — every badge creation, edit, award, and revocation is logged',
        ],
      },
      {
        category: 'improved',
        items: [
          'Badge operations return specific error messages — "already awarded", "not found", etc. — instead of generic errors',
        ],
      },
    ],
  },
  {
    version: '2026.04.129',
    date: '2026-04-11',
    title: 'Ready Checks, Chain of Command & API Keys',
    highlights: [
      'Start ready checks before operations — see who is ready in real time',
      'Set up a chain of command with tactical orders that flow down the hierarchy',
      'Generate API keys to connect external tools like Wingman AI',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Ready Check — start a ready check from any activity to poll participants before launch',
          'Chain of Command — assign Operation Commander, Fleet Commanders, and Squadron Leaders with tactical orders',
          '11 command types with three priority levels: Routine, Urgent, and Critical',
          'API Keys — generate scoped API keys in Settings to connect Wingman AI and other tools',
          'Wingman AI integration — voice-compatible endpoints for ready checks and commands',
        ],
      },
      {
        category: 'improved',
        items: [
          'Operations UI is more mobile-friendly — larger touch targets, stacked layouts on small screens',
        ],
      },
    ],
  },
  {
    version: '2026.04.128',
    date: '2026-04-10',
    title: 'Bounty Board, Trading & Moderation',
    highlights: [
      'Bounty Board is now live — create bounties, claim them, and track your hunter reputation',
      'Trading hub with live commodity prices powered by UEX Corp data',
      'Moderation tools for officers — manage incidents, lookup users, and track repeat offenders',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Bounty Board — create and manage bounties for your organization from Ops Center',
          'Bounty Hunter Profile — view your stats, rank, reputation, and claim history',
          'Trading — browse trade routes with profit estimates, manage price alerts, and view market trends',
          'Live commodity pricing — real-time price data from UEX Corp for accurate trade planning',
          'Moderation — manage warnings, timeouts, kicks, and bans from the Organization sidebar (officer+)',
          'User lookup — search any Discord user to see their full moderation history across your org',
          'Repeat offender tracking — risk scores highlight members with multiple incidents',
          'Discord bot auto-detection — bans, kicks, and timeouts in Discord are automatically logged as moderation incidents',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Bounty updates and deletes now work correctly — fixed an issue where these operations could silently fail',
          'Trading routes are now properly secured — only your organization\u2019s routes are visible',
          'Treasury operations now require proper permissions — admins for earn/spend/transfer, commissary purchases available to members',
          'Commissary purchases are now atomic — no more accidental double-charges if something goes wrong mid-purchase',
        ],
      },
      {
        category: 'improved',
        items: [
          'Better error messages across bounty, trading, and treasury features — clearer feedback when something goes wrong',
          'Treasury dues collection is now faster and more reliable for large organizations',
          'Trade route validation — stricter input checks prevent bad data from being saved',
        ],
      },
    ],
  },
  {
    version: '2026.04.128',
    date: '2026-04-10',
    title: 'Login Rate Limit Fix',
    highlights: [
      'Fixed "Too many login attempts" appearing for users who had not exceeded the limit',
      'Improved security against IP spoofing on login',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Login: resolved an issue where users could be incorrectly blocked with "Too many login attempts" — the platform now correctly identifies each user behind our CDN',
        ],
      },
      {
        category: 'improved',
        items: [
          'Login security: hardened IP detection to prevent spoofing via forged headers, so rate limits and lockouts are applied per-user accurately',
        ],
      },
    ],
  },
  {
    version: '2026.04.128',
    date: '2026-04-10',
    title: 'Mobile Navigation Overhaul',
    highlights: [
      'New bottom navigation bar on mobile — switch between hubs with a single tap',
      'Swipe from the left edge to open the sidebar on any page',
      'Active hub name now visible in the top bar on mobile so you always know where you are',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Bottom navigation bar on mobile — tap any hub icon (Dashboard, Ops, Organization, Alliance, Community) to jump there instantly',
          'Swipe-to-open sidebar — swipe from the left edge of the screen to reveal the full sidebar menu',
          'Active hub indicator in the top bar — shows the current hub name and icon on mobile',
        ],
      },
      {
        category: 'improved',
        items: [
          'Mobile sidebar now uses a proper drawer overlay with backdrop — tap outside to close',
          'Bottom navigation hides automatically when the sidebar is open to keep the screen uncluttered',
          'Content area no longer hidden behind the bottom bar — proper spacing applied',
          'Header height is now consistent across all components using a shared design token',
        ],
      },
    ],
  },
  {
    version: '2026.04.127',
    date: '2026-04-10',
    title: 'Member Search Fix & Directory Privacy',
    highlights: [
      'Member search no longer errors when a user has empty profile settings',
      'Members tab in the directory now only appears when you are signed in',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Member search: fixed a crash when users had empty profile preferences — the search now handles all edge cases correctly',
          'Intel audit: flag page size reduced to prevent loading too many records at once',
          'Admin charts: metrics dashboard charts now render at a fixed height for consistent layout',
        ],
      },
      {
        category: 'improved',
        items: [
          'Directory: Members tab is hidden for visitors who are not signed in — prevents unauthenticated API errors',
          'Relations page: updated icon to match the Handshake theme',
        ],
      },
    ],
  },
  {
    version: '2026.04.126',
    date: '2026-04-10',
    title: 'Community Members Directory',
    highlights: [
      'New "Members" tab in the Directories page — browse and discover other users',
      'Privacy-aware: only shows profiles that users have opted to make visible',
      'Search by username, sort by newest or alphabetical',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Members tab in Community Directories — browse users with public profiles',
          'Search members by username or display name',
          'Sort by newest members or alphabetically',
          'Pagination with result count indicator ("Showing 1\u201320 of 1,234 members")',
        ],
      },
      {
        category: 'improved',
        items: [
          'Member profiles respect all privacy settings — hidden fields stay hidden',
          'Organization-only profiles visible only to users who share an organization',
          'Skeleton card loading instead of spinners for a smoother experience',
        ],
      },
    ],
  },
  {
    version: '2026.04.125',
    date: '2026-04-10',
    title: 'Navigation Redesign & Hub Restructure',
    highlights: [
      'Fleet management moved into Ops Center — everything operational is now in one place',
      'New Alliance hub for diplomacy and federation management',
      'Sidebar sections group related items (Fleet, Planning, Communication, Tracking)',
      'Settings consolidated into a single tabbed page',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Alliance hub — Relations and Alliance Management now have their own dedicated top-level hub',
          'Sidebar sections — Ops Center items are grouped into Fleet, Planning, Communication, and Tracking sections',
          'Organization sidebar grouped into Members, Intel, and Management sections',
          'Settings page now uses tabs (Account, Privacy, Security, Notifications, API Keys) instead of separate pages',
          'Breadcrumbs show section context: Home > Ops Center > Fleet > Organization Ships',
        ],
      },
      {
        category: 'improved',
        items: [
          'Removed ~470 lines of unused legacy navigation code — faster page loads',
          '5 "Coming Soon" items hidden from sidebar to reduce clutter — still findable via Ctrl+K search',
          'Keyboard shortcuts updated: 1=Dashboard, 2=Ops Center, 3=Alliance, 4=Community',
        ],
      },
    ],
  },
  {
    version: '2026.04.124',
    date: '2026-04-10',
    title: 'Dashboard & Table Performance Upgrades',
    highlights: [
      'Dashboard widgets now load independently — one slow widget no longer holds up the whole page',
      'Large tables (100+ rows) now use virtual scrolling for smooth performance',
      'New skeleton loading animations match page layouts for a smoother experience',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Dashboard widgets have individual error boundaries — if one widget fails, others keep working',
          'Tables with 100+ rows automatically use virtual scrolling (only visible rows are rendered)',
          'Page skeleton loading states match actual page layouts instead of generic spinners',
        ],
      },
      {
        category: 'improved',
        items: [
          'Dashboard widgets show skeleton loading animation while their data loads',
          'Large member lists, ship tables, and bounty boards scroll smoothly even with hundreds of entries',
        ],
      },
    ],
  },
  {
    version: '2026.04.123',
    date: '2026-04-10',
    title: 'Smarter Search & Bot Reliability',
    highlights: [
      'Search across the platform is now significantly faster with full-text indexing',
      'The Discord bot can now scale to serve many guilds simultaneously',
      'Activity participant data fully migrated to optimized storage',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Search for ships, activities, organizations, members, bounties, missions, and fleets is now powered by PostgreSQL full-text search — much faster than before, especially for partial matches',
          'Discord bot supports sharding for large-scale deployments (thousands of connected servers)',
          'All activity participant operations now use the optimized database table — the old JSON storage is fully retired',
          'Joining and leaving activities is faster and more reliable',
        ],
      },
    ],
  },
  {
    version: '2026.04.122',
    date: '2026-04-10',
    title: 'Job Queue & Edge Security',
    highlights: [
      'Background jobs now use a proper job queue with automatic retry on failure',
      'Azure Front Door CDN provides edge caching and DDoS protection',
      'Development login system fully modernized',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Background tasks (GDPR exports, cleanup jobs, org deletion) now retry automatically if they fail — no more silent failures',
          'Azure Front Door CDN with edge caching for public pages and static assets',
          'WAF (Web Application Firewall) protection with rate limiting and SQL injection blocking',
        ],
      },
      {
        category: 'improved',
        items: [
          'Job monitoring: failed jobs are tracked and retried up to 3 times with increasing delays',
          'Public pages (directory, sitemap) served from edge cache for faster global access',
          'Frontend static assets compressed with Brotli for smaller downloads',
        ],
      },
    ],
  },
  {
    version: '2026.04.121',
    date: '2026-04-10',
    title: 'Complete Redis Caching — All 10 Key Dashboards',
    highlights: [
      'All major dashboards now cached in Redis — repeated loads are near-instant',
      'Dashboard, fleet, bounty, activity, trading, directory, sitemap, trust score, and member stats all cached',
      'Trust score cache now works across all server instances (was previously per-instance only)',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Main dashboard summary cached for 5 minutes — the 21-query aggregation now returns instantly on repeat loads',
          'Member activity trends cached for 10 minutes',
          'Trust score upgraded from per-instance cache to shared Redis cache (works across all server replicas)',
          'Sitemap XML cached for 1 hour — search engine crawlers no longer trigger expensive queries',
          'Activity analytics cached for 10 minutes',
          'Trade and logistics overview cached for 5 minutes',
          'All caches degrade gracefully — if Redis is unavailable, everything works normally (just slower)',
        ],
      },
    ],
  },
  {
    version: '2026.04.120',
    date: '2026-04-09',
    title: 'Calendar & Activity Performance Upgrade',
    highlights: [
      'Calendar now loads only the events you can see instead of everything',
      'Calendar and ICS export queries are 80% lighter — large participant lists no longer included in calendar data',
      'Activity participation data is safer and more reliable with atomic database operations',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Calendar page now fetches events for a focused date range (3 months back, 6 months forward) instead of all events ever created',
          'Calendar and ICS export no longer load large participant lists — only event metadata is fetched',
          'Participant sync uses atomic database operations to prevent race conditions during simultaneous joins',
          'Data migration for participant normalization processes in safe batches with validation',
        ],
      },
    ],
  },
  {
    version: '2026.04.119',
    date: '2026-04-09',
    title: 'Activity Participants Database Optimization',
    highlights: [
      'Activity participation data is now stored in a proper database table instead of a JSON blob',
      'Participation analytics now use SQL queries instead of loading all data into memory',
      'New capability: look up all activities a user has joined (previously impossible)',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Joining and leaving activities is now faster and more reliable with proper database operations instead of JSON manipulation',
          'Participation analytics (top participants, unique counts) now use efficient SQL queries instead of loading thousands of records into memory',
          'Activity participant lookups use database indexes for instant results',
          'You can now query all activities a specific user has participated in',
        ],
      },
    ],
  },
  {
    version: '2026.04.118',
    date: '2026-04-09',
    title: 'Complete Job Consolidation',
    highlights: [
      '13 of 14 background jobs now run in the dedicated worker process',
      'Session cleanup, expired poll closing, and token cleanup added to the worker',
      'JWT token blacklist cleanup now active (was previously defined but never started)',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Session cleanup, refresh token cleanup, and poll auto-close now run in the worker process',
          'Only JWT blacklist cleanup remains in the API server (requires process-local cache access)',
        ],
      },
      {
        category: 'fixed',
        items: [
          'JWT blacklist cleanup was defined but never called — now properly activated on startup',
          'Expired polls are now automatically closed every 5 minutes (was previously dead code)',
        ],
      },
    ],
  },
  {
    version: '2026.04.117',
    date: '2026-04-09',
    title: 'Worker Container & Job Scheduling Improvements',
    highlights: [
      'All 10 background jobs now run in the isolated worker process with proper scheduling',
      'Job time zones fixed — all scheduled tasks now run at the correct UTC time globally',
      'Organization deletion requests are processed immediately on startup instead of waiting up to 1 hour',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'All 10 background jobs now properly scheduled in the worker: RSI sync, GDPR cleanup, GDPR exports, org deletion processing, org deletion reminders, backup scheduler, export cleanup, ship data fetcher, intel audit rotation, RSI crawler',
          'Organization deletion processor now runs immediately on worker startup to catch any overdue deletions',
          'Worker database connection includes auto-reconnect and health monitoring',
          'Export cleanup staggered to 2:30 AM to avoid competing with ship data fetcher for resources',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Job scheduling now uses UTC consistently — GDPR cleanup and Intel rotation were using local time instead of UTC',
          'Background jobs no longer run in both the API server and worker simultaneously',
          'Worker properly closes database connections during graceful shutdown',
        ],
      },
    ],
  },
  {
    version: '2026.04.116',
    date: '2026-04-09',
    title: 'Background Job Isolation',
    highlights: [
      'Heavy background tasks (RSI sync, data cleanup, ship catalog updates) now run in an isolated process',
      'API server is no longer slowed down by long-running crawlers or data maintenance jobs',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Background jobs (RSI crawler, data cleanup, ship catalog updates) now run in a dedicated worker process instead of sharing the API server',
          'API response times are more consistent during heavy background processing',
          'Worker process has its own database connection pool and memory budget',
        ],
      },
    ],
  },
  {
    version: '2026.04.115',
    date: '2026-04-09',
    title: 'SCStats Analytics Fix & Chart Stability',
    highlights: [
      'SCStats organization analytics (K/D ratios, flight hours, top performers) now load correctly in production',
      'Charts across the platform no longer error when their container is very narrow',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'SCStats analytics: K/D ratios, total hours, and missions completed now display correctly — a database column naming issue was causing empty results',
          'Charts: all Recharts containers now have a minimum width to prevent rendering errors on narrow screens or collapsed panels',
        ],
      },
    ],
  },
  {
    version: '2026.04.114',
    date: '2026-04-09',
    title: 'Ship & Federation Performance Upgrades',
    highlights: [
      'Organization available ships page loads faster with a single optimized query',
      'Federation statistics no longer load thousands of member records unnecessarily',
      'Global announcements broadcast 5x faster with parallel processing',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Organization available ships: combined into a single database query instead of three sequential lookups',
          'Bounty hunter stats: claim counts computed directly in the database instead of loading all records',
          'Federation public stats: member counts use SQL aggregation instead of loading all member entities',
          'Federation permission checks no longer load member data when only metadata is needed',
          'Global broadcast announcements process 5 guilds at a time instead of one-by-one (5x faster)',
          'Inventory restocking predictions filter irrelevant items at the database level',
          'Recruitment settings cached per module instead of re-created on every button click',
        ],
      },
    ],
  },
  {
    version: '2026.04.113',
    date: '2026-04-09',
    title: 'Alliance Invitation Notifications',
    highlights: [
      'Organization leaders now receive instant notifications when invited to join an alliance',
      'Accept or decline alliance invitations directly from the landing page',
      'Dashboard shows pending alliance invitations alongside other approvals',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'In-app notifications for alliance invitations — org owners and admins are automatically notified when their organization is invited to join an alliance',
          'Real-time WebSocket alerts deliver invitation notifications instantly without page refresh',
          'Alliance founders and leaders are notified when an invited organization accepts and joins',
          'Accept and Decline buttons on the Alliance landing page for pending invitations',
          'Dashboard Pending Approvals widget now includes pending alliance invitations with a direct link to review them',
        ],
      },
      {
        category: 'improved',
        items: [
          'Alliance landing page now visually separates pending invitations from active memberships',
          'Auto-redirect to manage page only happens when there are no pending invitations to review',
        ],
      },
    ],
  },
  {
    version: '2026.04.112',
    date: '2026-04-09',
    title: 'Security & Reliability Fixes',
    highlights: [
      'Improved query safety for engagement tracking',
      'Fixed an issue where some intel entries could be skipped during automatic declassification',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Intel auto-declassification now correctly processes all eligible entries without skipping any during batch processing',
          'Engagement tracking uses safer database query patterns',
          'Discord bot now logs rate limit errors during batch role assignments instead of silently ignoring them',
        ],
      },
    ],
  },
  {
    version: '2026.04.111',
    date: '2026-04-09',
    title: 'Reputation Leaderboard Optimization',
    highlights: [
      'Category reputation leaderboards now load instantly — database handles sorting instead of loading all records',
      'Global leaderboard no longer floods the database with concurrent queries',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Category reputation leaderboards (communication, teamwork, skill, etc.) now use database-level JSON extraction and sorting instead of loading the entire reputation table into memory',
          'Global reputation leaderboard processes lookups in controlled batches of 5 instead of firing 40+ database queries simultaneously',
        ],
      },
    ],
  },
  {
    version: '2026.04.110',
    date: '2026-04-09',
    title: 'Bot Performance, Calendar Limits & Trading Optimization',
    highlights: [
      'Discord bot role assignments are now 10x faster with batch processing',
      'Message tracking no longer writes to the database on every single message — buffered for efficiency',
      'Trading market updates now only notified to users on the trading page instead of everyone',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Discord bot: stat role assignment is now batch-processed with controlled concurrency instead of one-at-a-time API calls',
          'Discord bot: message engagement tracking batched every 30 seconds instead of per-message database writes',
          'Calendar export: default date bounds applied (6 months history, 12 months ahead) with 5,000-event cap — prevents slow exports for large organizations',
          'Trading: market updates, price changes, and opportunity alerts are now scoped to trading page subscribers instead of broadcasting to all connected users',
          'Alliance dashboard: diplomacy information loaded in a single batch instead of one query per alliance',
          'Intel: auto-declassification processes entries in manageable batches instead of loading everything at once',
          'Trading routes: endpoint now indicates when results are clipped so you know there are more to load',
          'Recurring activities: occurrence limits from recurrence rules are now correctly respected',
          'Directory stats endpoint consolidated into a single optimized query',
          'Voice channels: orphaned channels cleaned up automatically if move fails',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Treasury cache refresh time reduced from 5 minutes to 1 minute for more accurate balance display',
          'Intel officer eligibility check now filters by rank at the database level instead of loading all officers',
          'Public directory and SEO endpoints now have appropriate rate limiting (was too permissive)',
        ],
      },
    ],
  },
  {
    version: '2026.04.109',
    date: '2026-04-09',
    title: 'Performance & Security Improvements',
    highlights: [
      'Treasury notifications are now private — balance details sent only to involved parties',
      'Bounty search pagination is twice as fast with single-query page counts',
      'Alliance dashboards, ship inventories, and calendar views load faster with SQL optimization',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Bounty search: page navigation is now 2x faster — uses a single query instead of two separate database calls',
          'Ship inventory summary: status, condition, and sharing breakdowns use SQL aggregation instead of loading all ships',
          'Alliance dashboard: activity statistics fetched in a single query instead of two',
          'Route sharing: finding shared routes is now instant (O(1) lookup) instead of scanning all routes',
          'Reputation: pending ratings check reduced from ~100 individual queries to a single batch query',
          'Calendar: events capped at 500 per view to prevent slow loads on large date ranges',
          'Discord bot: mirror sync and channel counters are more efficient with caching and early-exit optimizations',
          'New database indexes for alliance diplomacy lookups',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Treasury balance amounts are no longer broadcast to all organization members — only transaction participants see balance details',
          'Ship insurance renewal count now correctly includes ships expiring within 30 days (was only counting already-expired)',
          'Real-time event batching now works correctly with all existing notification listeners',
          'Improved SQL query safety in logistics dashboard metrics',
        ],
      },
    ],
  },
  {
    version: '2026.04.108',
    date: '2026-04-09',
    title: 'Real-Time Event Batching & More SQL Optimizations',
    highlights: [
      'WebSocket events are now batched during bursts — one message per 100ms window instead of thousands of individual messages',
      'Notification updates are debounced so rapid activity bursts don\u2019t cause excessive page refreshes',
      'Trust scores and price alerts are now computed with SQL aggregation instead of loading all data',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Real-time events: organization broadcasts are now batched during bursts — if 100 events fire in quick succession, they arrive as a single batch instead of 100 separate messages',
          'Notifications: rapid bursts of notifications now trigger a single data refresh instead of one per notification, reducing page flicker',
          'Trust scores: member reputation averages are now computed in the database instead of loading all member reputation records',
          'Price alerts: commodity check queries now fetch only distinct commodity names instead of all alert rows',
        ],
      },
    ],
  },
  {
    version: '2026.04.107',
    date: '2026-04-09',
    title: 'Analytics & Dashboard Speed Boost',
    highlights: [
      'Organization analytics, hunter profiles, and dashboard ship counts are now dramatically faster for large orgs — three more services converted from full-table scans to SQL aggregation',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'SCStats analytics: verified member averages (K/D, hours, missions) and top performers are now computed in the database instead of loading all member data',
          'Hunter profiles: claim statistics, reward totals, completion times, and specialization counts all use SQL aggregation instead of loading every claim',
          'Dashboard: member ship counts now use a JOIN instead of building a list of 25K+ member IDs — much faster for large organizations',
        ],
      },
    ],
  },
  {
    version: '2026.04.106',
    date: '2026-04-09',
    title: 'API Rate Protection & More Performance Gains',
    highlights: [
      'All API list endpoints now enforce a maximum page size of 200 items — prevents slow queries from oversized requests',
      'Fleet summary and logistics dashboard are now computed with SQL aggregation instead of loading all records',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'API security: all list endpoints now cap page sizes at 200 items — requests for huge result sets are automatically limited for stability',
          'Fleet summary: ship role, status, condition, capital count, value, and maintenance costs are now computed in the database instead of loading every ship',
          'Logistics dashboard: inventory, alert, and operations metrics all use SQL aggregation — much faster for fleets with hundreds of items',
        ],
      },
    ],
  },
  {
    version: '2026.04.105',
    date: '2026-04-09',
    title: 'Large Organization Performance Boost',
    highlights: [
      'Bounty statistics, member stats, poll results, and treasury summaries now load significantly faster for organizations with thousands of entries',
      '15 new database indexes target the most common query patterns so pages load faster as your org grows',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Bounty statistics: counts and reward totals are now computed directly in the database instead of loading every bounty — much faster for orgs with hundreds of bounties',
          'Member statistics: role counts, recent joins, and departures are calculated in a single database query instead of loading all members into memory',
          'Poll results: vote counts and percentages are computed with SQL aggregation instead of loading every vote — snappier for popular polls',
          'Treasury summary: income, expenses, and transaction count now come from one query instead of three',
          '15 new database indexes added for members, ships, activities, trades, bounties, polls, intel, and more — all pages that list or filter data benefit',
        ],
      },
    ],
  },
  {
    version: '2026.04.104',
    date: '2026-04-09',
    title: 'Ticket Form Validation',
    highlights: [
      'Creating a ticket now validates subject and description length before submitting, so you see clear error messages instead of a silent failure',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Tickets: creating a ticket with a short subject (under 3 characters) or description (under 10 characters) now shows an inline error instead of failing silently',
          'Tickets: subject is capped at 200 characters and description at 5,000 characters to match server limits',
          'Tickets: fixed a typo on the empty-state placeholder ("Select a ticket to view details")',
        ],
      },
    ],
  },
  {
    version: '2026.04.103',
    date: '2026-04-09',
    title: 'Ticket Search Validation & Data Integrity',
    highlights: ['Ticket search is now validated and trimmed to prevent excessively long queries'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Tickets: search field now enforces a 200-character limit and trims whitespace, matching the pattern used by all other search endpoints',
          'Tunnels: IDs are now proper UUIDs — custom ID formats from earlier versions are no longer generated',
        ],
      },
    ],
  },
  {
    version: '2026.04.102',
    date: '2026-04-09',
    title: 'Attendance Activity Picker & Shared Account Fixes',
    highlights: [
      'The Activity Report tab now shows a list of your completed activities below the search field — click any activity to instantly load its attendance report',
      'Shared account forms use clearer field names (Account Name, Account Username) to distinguish the display name from login credentials',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Attendance: the Activity Report tab now lists your completed activities for quick selection — no need to remember or paste activity IDs',
        ],
      },
      {
        category: 'improved',
        items: [
          'Shared Accounts: renamed form fields from "Name/Username" to "Account Name/Account Username" to make it clear which field is the display name and which is the login credential',
          'Shared Accounts: API endpoint path corrected for consistent routing',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Shared Accounts: creating a shared account no longer fails silently — the API path and field names now match the backend',
          'Intel Vault: creating an intel entry no longer returns a 400 error when the location field is left empty or when a date is selected',
          'Intel Officers: appointing or editing an officer no longer fails when the notes field is left blank',
        ],
      },
    ],
  },
  {
    version: '2026.04.101',
    date: '2026-04-09',
    title: 'Activity Notifications & Intel Improvements',
    highlights: [
      'You now receive in-app notifications when activities are created, someone joins your activity, or an activity is completed or cancelled',
      'The Members tab in Member Audit shows flag count badges next to each member so you can spot flagged members at a glance',
      'Appointing intel officers now uses a searchable member picker instead of pasting user IDs',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Activities: creating an activity sends an in-app notification to all organization members with a direct link',
          'Activities: joining an activity sends a notification to the activity creator so they know who signed up',
          'Activities: completing or cancelling an activity notifies the organization',
          'Member Audit: the Members tab now displays a flag badge next to each member with open or escalated flags — warnings for 1-2 flags, errors for 3 or more',
          'Recruitment: new region tags (NA, EU, OCE, SA, APAC) available for organization recruitment profiles',
          'Tickets: new close, reopen, and feedback endpoints for ticket lifecycle management',
        ],
      },
      {
        category: 'improved',
        items: [
          'Activities: re-joining an activity you already belong to now updates your ship and crew assignment instead of showing an error',
          'Intel Officers: appointing an officer now uses a searchable dropdown populated from your member list — no more copy-pasting user IDs',
          'Intel Officers: members already serving as active officers are automatically filtered out of the appointment dropdown',
        ],
      },
    ],
  },
  {
    version: '2026.04.100',
    date: '2026-04-09',
    title: 'Announcements & Polls Upgrade',
    highlights: [
      'Announcements now support scheduling, Discord embed customization (color, author, images, footer), and a live embed preview',
      'Polls show results and voting controls directly in each card — no more opening a separate dialog',
      'Active polls let you change your vote without leaving the page',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Announcements: schedule announcements for future delivery with a date and time picker',
          'Announcements: configure Discord embed settings — accent color, author name and avatar, thumbnail, banner image, footer text, and footer icon',
          'Announcements: live embed preview while editing so you can see exactly how it will look in Discord',
          'Polls: create dialog now supports setting an end date for automatic poll closure',
          'Polls: create dialog now includes visibility (public, members only, role restricted) and max selections for multiple-choice polls',
          'Polls: results with progress bars display directly in each poll card',
          'Polls: vote directly from the poll card without opening a separate dialog',
          'Polls: change your vote on active polls with a single click',
        ],
      },
      {
        category: 'improved',
        items: [
          'Announcements: scheduled announcements show a styled chip with the scheduled date and time',
          'Polls: cards show a "Voted" badge when you have already cast your vote',
        ],
      },
    ],
  },
  {
    version: '2026.04.99',
    date: '2026-04-09',
    title: 'Security Levels Moved to Relations',
    highlights: [
      'Inter-org security levels now live on the Relations page as a dedicated "Security Levels" tab — right next to Relationships and Alliances where they belong',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Security levels moved from Organization Settings to Relations — you no longer need to hunt through settings to manage cross-org access controls',
          'Relations page now has three tabs: Relationships, Alliances, and Security Levels',
        ],
      },
    ],
  },
  {
    version: '2026.04.98',
    date: '2026-04-09',
    title: 'RSI Sync Detail View & Notification Persistence',
    highlights: [
      'Clicking any row in the RSI Sync Operations table now opens a detail dialog showing exactly what changed — roles, ranks, new members, departures, and errors',
      'Notifications now persist between sessions and pages — real-time WebSocket events merge with your saved notifications',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'RSI Sync: click any sync operation to see a detailed breakdown of every change — roles added/removed, rank changes, departing members, new members detected, and any sync errors',
          'Notifications: your notification history is now fetched from the server and merged with live WebSocket updates so nothing gets lost when you switch pages or refresh',
        ],
      },
      {
        category: 'improved',
        items: [
          'Notifications: marking as read and clearing notifications now persists to the backend instead of only updating the local browser state',
          'Notifications: deleting a notification now removes it from the server — previously it would reappear after refreshing',
        ],
      },
    ],
  },
  {
    version: '2026.04.97',
    date: '2026-04-09',
    title: 'Account Linking Fix & Ticket Visibility',
    highlights: [
      'Connecting Google or Twitch from your profile now correctly links to your existing account instead of creating a duplicate',
      'Non-admin users can now see tickets they are assigned to or routed to — not just tickets they created',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Connected accounts: linking Google or Twitch with a different email no longer creates a separate account — your identity is preserved through the OAuth redirect',
          'Connected accounts: attempting to link a provider already connected to another user now shows a clear error instead of crashing',
        ],
      },
      {
        category: 'improved',
        items: [
          'Tickets: non-admin members can now see tickets where they are the creator, the assignee, or the recipient — previously only tickets you created were visible',
        ],
      },
    ],
  },
  {
    version: '2026.04.96',
    date: '2026-04-09',
    title: 'Activity Template Ship Requirements',
    highlights: [
      'Activity templates now let you specify required and preferred ships, plus participant limits, duration, and location details',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Activity templates: new Required Ships and Preferred Ships fields — select from the ship catalogue or type custom ship names',
          'Activity templates: new Participants & Duration section with min/max participants and estimated duration',
          'Activity templates: new Location section with star system, planet/moon, and location details',
        ],
      },
      {
        category: 'improved',
        items: [
          'Create/Edit Template dialog is now organized into clear sections: Basic Info, Participants & Duration, Location, Ship Requirements, and Tags & Visibility',
        ],
      },
    ],
  },
  {
    version: '2026.04.95',
    date: '2026-04-09',
    title: 'Activity Ship Switching & Loan Search',
    highlights: [
      'Loan Ships dialog now has a search bar — filter your hangar by name instantly',
      'Already in an activity? Use "Switch Ship" to change your ship without leaving and re-joining',
      'Ship labels no longer show "undefined" when catalogue data is missing',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Loan Ships: search bar lets you filter your hangar by ship name, manufacturer, or model — results update as you type',
          'Loan Ships: Select All / Deselect All now applies only to visible (filtered) ships so you can batch-select precisely',
          'Activity detail: participants can click "Switch Ship" to update their ship assignment without leaving the activity',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Loan Ships: ship entries no longer display "undefined undefined" — missing manufacturer or model data is handled gracefully',
          'Loan Ships: loaning ships no longer fails with a validation error when ship model data is unavailable from the catalogue',
          'Join Activity: the ship picker no longer shows "undefined" in the dropdown when catalogue fields are missing',
        ],
      },
    ],
  },
  {
    version: '2026.04.93',
    date: '2026-04-09',
    title: 'Smarter Fleet & Team Assignment on Operations',
    highlights: [
      'Fleet and team fields on the Create Operation dialog are now searchable dropdowns — pick from your actual fleets and teams instead of copy-pasting IDs',
      'Selecting a fleet that belongs to a team (or vice versa) automatically fills in the linked field',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Operations: fleet and team assignment uses searchable dropdowns populated from your organization instead of raw text fields',
          'Operations: selecting a fleet linked to a team auto-fills the team, and selecting a team linked to a fleet auto-fills the fleet',
          'Operations: paired form fields (type/difficulty, priority/location, dates, fleet/team) now always display side-by-side for a cleaner layout',
        ],
      },
    ],
  },
  {
    version: '2026.04.94',
    date: '2026-04-09',
    title: 'Hangar Search & Fleet Filters',
    highlights: [
      'Personal Hangar now has a search bar — find ships by name instantly',
      'Fleet Operations role and size filters now show your actual ship types instead of a generic list',
      'Cleaned up statistics panels — "Unknown" entries no longer clutter your breakdowns and charts',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Personal Hangar: search bar lets you filter ships by name, custom name, or notes — results update as you type with a short delay to keep things smooth',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fleet Operations: role and size dropdowns now show the actual roles and sizes from your fleet (e.g., "Light Fighter", "Snub", "Sub Capital") instead of a static list that often didn\'t match',
          'Fleet Operations: clicking a role or size chip now toggles the filter — click once to filter, click again to clear',
          'Statistics: "Unknown" entries are no longer shown in breakdown chips, pie charts, or distribution panels across both Personal Hangar and Fleet Operations',
        ],
      },
      {
        category: 'improved',
        items: [
          'Fleet Operations: role and size filters use case-insensitive matching so filters always work regardless of how the data is capitalized',
        ],
      },
    ],
  },
  {
    version: '2026.04.92',
    date: '2026-04-09',
    title: 'Inter-Org Security Fix',
    highlights: [
      'The target organization dropdown on the Inter-Org Security tab now correctly shows organizations from your diplomatic relationships',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Inter-org security: target organization dropdown was empty — it now populates from your active diplomatic relationships instead of a broken static list',
          'Inter-org security: added a helpful message when no diplomatic relationships exist, explaining why the dropdown is empty',
        ],
      },
      {
        category: 'improved',
        items: [
          'Inter-org security: target organization field is now required to prevent submitting without selecting an organization',
        ],
      },
    ],
  },
  {
    version: '2026.04.91',
    date: '2026-04-09',
    title: 'Directory & Profile Polish',
    highlights: [
      'Organization, alliance, and opportunity cards in the directory are now all the same size — no more uneven rows',
      'Focus area labels on organization profiles are cleaner with text-only chips instead of misaligned icons',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Directory: all cards in a row now stretch to the same height and width for a uniform grid layout',
          'Organization profile: focus area chips (Mining, Salvage, Trading, etc.) simplified to clean text labels',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Organization profile: removed misaligned icons from focus area chips that caused vertical alignment issues',
        ],
      },
    ],
  },
  {
    version: '2026.04.90',
    date: '2026-04-09',
    title: 'Compact Fleet Cards',
    highlights: [
      'Fleet cards now pack all information into a single dense row — name, type, counts, health, cargo, fuel, and capability icons all at a glance',
      'Capability indicators (Refuel, Rearm, Repair, Medical) are now compact icon badges with tooltips — hover to see which ships provide the capability',
      'Tighter card spacing lets you see more fleets without scrolling',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Fleet cards: all stats and capability indicators merged into one compact row instead of two or three stacked rows — much better use of space when you have many fleets',
          'Capability badges: Refuel, Rearm, Repair, and Medical indicators are now small icon-only badges — hover any badge to see which ships provide that capability',
          'Fleet list: tighter spacing between cards so more fleets fit on screen at once',
        ],
      },
    ],
  },
  {
    version: '2026.04.89',
    date: '2026-04-09',
    title: 'Organization Ship Search & Fleet Loading Improvements',
    highlights: [
      'You can now search organization ships by name — type in the search field to instantly find any ship in your fleet',
      'Fleet ship queries are smarter — different pages and filters get their own cache so changing views is snappier',
      'Organization cards in the directory are now the same height for a cleaner grid layout',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Organization ships: new search field lets you filter ships by name across your entire fleet',
        ],
      },
      {
        category: 'improved',
        items: [
          'Fleet queries: ship data is now cached per-page so switching between fleets or pages no longer flickers or shows stale data',
          'Organization fleet tab: ships load in bulk for instant client-side filtering and sorting instead of paginating server calls',
          'Directory: organization cards stretch to equal height for a cleaner grid appearance',
        ],
      },
    ],
  },
  {
    version: '2026.04.88',
    date: '2026-04-09',
    title: 'Accurate Fleet Ship Counts & Security Level UX',
    highlights: [
      'Fleet ship counts now exclude deleted ships — your totals finally match what you actually see',
      'Setting security levels between organizations is easier — target orgs are picked from a dropdown of your diplomatic relationships instead of typing UUIDs',
      'The "+N more ships" badge on fleet cards now shows the correct overflow count',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fleet ship counts: soft-deleted ships are no longer counted in fleet totals — the number you see now matches the ships actually in the fleet',
          'Fleet card preview: the "+N" overflow badge now reflects the real total ship count, not just the current page',
        ],
      },
      {
        category: 'improved',
        items: [
          'Security levels: the target organization is now selected from a dropdown of your diplomatic relationships instead of manually entering a UUID — much faster and less error-prone',
          'Organization cards: focus icons now use the proper MUI Chip icon slot for cleaner rendering',
        ],
      },
    ],
  },
  {
    version: '2026.04.87',
    date: '2026-04-08',
    title: 'Fleet Capabilities, UI Refresh & Bug Fixes',
    highlights: [
      'Fleet statistics now show medical ship capability and list the specific ships providing refuel, rearm, repair, and medical support',
      'Alliance service refactored for better code quality and batch-loading of organization names',
      'Over 40 components received UI polish — cleaner layouts, better spacing, and consistent card styles',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Fleet capabilities: medical ship detection added alongside refuel, rearm, and repair — the fleet statistics panel now shows which specific ships provide each capability',
          'Activity icons: shared icon utility for consistent activity type icons across all components',
        ],
      },
      {
        category: 'improved',
        items: [
          'Fleet statistics: capability chips now show ship names on hover, making it clear which ships provide refuel, rearm, repair, or medical support',
          'Image loading: cross-origin resource policy header added so images load correctly across domains',
          'Alliance service: organization names are now batch-loaded instead of queried one at a time',
          'Over 40 components received layout and styling improvements for a more polished look',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Bounty rewards: a bounty with a 0 aUEC reward now correctly shows "0 aUEC" instead of "Negotiable"',
          'Hunter profile: same fix applied to reward totals on the hunter profile page',
        ],
      },
    ],
  },
  {
    version: '2026.04.86',
    date: '2026-04-08',
    title: 'Federation Agreement Details & Layout Improvements',
    highlights: [
      'Federation agreements now track review dates, expiry dates, and auto-renewal settings',
      'Alliance statistics upgraded to a modern card layout with color-coded categories',
      'Discord settings forms now use a vertical layout that is easier to read and fill out',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Federation settings: new Agreement Details section with review date, expiry date, and auto-renew toggle — track when your agreements need attention',
        ],
      },
      {
        category: 'improved',
        items: [
          'Alliance statistics: redesigned from a flat bar to individual stat cards with color-coded backgrounds and large numbers for quick scanning',
          'Alliance list: each alliance now appears in its own bordered card instead of a plain row',
          'Discord settings: voice channels, tunnels, tickets, roles, and recruitment forms now use a vertical layout that fits better on all screen sizes',
          'Images: banner and logo images on public pages now load without requiring a login session',
        ],
      },
    ],
  },
  {
    version: '2026.04.85',
    date: '2026-04-08',
    title: 'Fleet Audit Logs Persisted & Image URLs Fixed',
    highlights: [
      'Fleet change history is now saved to the database — your audit trail survives server restarts and is fully searchable',
      'Images on recruitment posts and federation pages now load correctly across all environments',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Fleet audit log: all fleet events (ship adds, team changes, hierarchy moves) are now written to the database for permanent storage — the in-memory log is kept as a fast fallback',
          'Fleet audit queries: retrieving the audit log now reads from the database with filtering by fleet, action, and date range',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Images: banner and logo images now use absolute URLs so they load correctly when the frontend and API are on different domains',
        ],
      },
    ],
  },
  {
    version: '2026.04.84',
    date: '2026-04-08',
    title: 'Image Security & Login Redirect Fixes',
    highlights: [
      'Uploaded images are now securely proxied through the API — no direct access to storage',
      'Browsing public pages like the directory or changelog no longer triggers unexpected login redirects',
      'Recruitment cards and banners load reliably with proper image handling',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Images: all uploaded images (banners, logos, avatars) are now served through a secure API proxy with one-year browser caching — faster loads on repeat visits',
          'Login redirects: public pages (directory, changelog, opportunities, join links) no longer redirect to login when a session expires — you can browse freely without signing in',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Recruitment: banner and logo images on recruitment cards and details now display correctly after the storage security update',
          'Organization cards: recruitment data only loads when you are signed in, preventing unnecessary errors for visitors',
        ],
      },
    ],
  },
  {
    version: '2026.04.83',
    date: '2026-04-08',
    title: 'Fleet Activity History — Persistent Storage',
    highlights: [
      'Fleet change history is now stored permanently — logs survive server restarts and are never lost',
      'All fleet events (ship adds, team changes, hierarchy updates) are recorded to a dedicated audit table',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Fleet audit log: all fleet lifecycle events are now persisted to the database instead of being kept only in memory — you will never lose change history after a restart',
          'Fleet history queries can now be filtered by fleet, organization, and time range with fast indexed lookups',
        ],
      },
    ],
  },
  {
    version: '2026.04.82',
    date: '2026-04-08',
    title: 'Compact Skill Bars & Unknown Fix',
    highlights: [
      'Skill distribution bars are now compact — each career takes a single row with a color-coded inline bar',
      'Unknown career entries are no longer shown — ships without a career are now classified by their role',
      'Over 30 ships that previously showed as Unknown now have correct career categories',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Skill bars: redesigned to a compact layout — one row per career with a shared legend at the top, taking significantly less screen space',
          'Career labels: colored to match their category (Combat is red, Mining is yellow, etc.)',
          'Hover any bar to see the exact member count per tier',
        ],
      },
      {
        category: 'fixed',
        items: [
          "Unknown career: ships like the Merchantman, Javelin, Orion, all Teach's Special variants, and 25+ other ships now have correct careers instead of showing as Unknown",
          'Ships without a career in the catalogue now attempt to infer one from their role (e.g., a ship with a Mining role gets classified as Mining)',
        ],
      },
    ],
  },
  {
    version: '2026.04.81',
    date: '2026-04-08',
    title: 'Smarter Ship Career Categories',
    highlights: [
      'Ship careers now show refined display categories — Hauling, Mining, Salvaging, Gunship, Capital Crew, and more',
      'Starter and Industrial ships are automatically grouped by their actual role instead of a generic label',
      'File uploads (like CSV imports) now work reliably without content-type conflicts',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          "Ship careers: raw catalogue values are now mapped to user-friendly categories — Transporter becomes Hauling, Support becomes Medical, Industrial splits into Mining or Salvaging based on the ship's role",
          'Combat ships: large combat ships (frigates, destroyers, corvettes) are automatically classified as Capital Crew, while gunship-class ships get their own Gunship category',
          'Starter ships: automatically redistributed into their actual career (e.g., a Starter with a Mining role counts as Mining, not Starter)',
          'Organization cards: removed the legacy skill distribution bars section — career data is now shown exclusively on the org dashboard',
          'Skill distribution bars: updated color palette to distinguish new categories like Hauling, Mining, Salvaging, and Capital Crew',
        ],
      },
      {
        category: 'fixed',
        items: [
          'File uploads: CSV and other file imports no longer fail due to incorrect content-type headers — the browser now sets the correct multipart boundary automatically',
        ],
      },
    ],
  },
  {
    version: '2026.04.80',
    date: '2026-04-08',
    title: 'Security & Stability Improvements',
    highlights: [
      'Relationship data is now strictly scoped to your organization — cross-org access is blocked',
      'RSI crawler admin operations require elevated permissions',
      'Discord settings switches now reflect correct initial states',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Diplomacy: relationship updates and reads are now restricted to your organization — previously some endpoints did not verify org ownership',
          'RSI Crawler: cache clearing and data deletion now require admin permissions',
          'Discord: toggle switches in admin settings now show the correct initial state instead of always defaulting to off',
        ],
      },
    ],
  },
  {
    version: '2026.04.79',
    date: '2026-04-08',
    title: 'Diplomacy RSI Profiles & Member Trends',
    highlights: [
      "Relationship rows now show the target organization's RSI profile with member count, archetype, and links",
      "Track how a related organization's membership changes over time with an inline trend chart",
      'Editing relationships now saves all fields correctly — no more validation errors',
    ],
    changes: [
      {
        category: 'added',
        items: [
          "Diplomacy: expanding a relationship now shows the target org's RSI profile — archetype, member count, primary focus, commitment, language, recruiting status, and direct links to their RSI page, website, and Discord",
          'Diplomacy: a Member Count Over Time chart is shown for each relationship with RSI data, tracking membership growth or decline between crawler runs',
          'Diplomacy: changes to communication channels, public/private visibility, and auto-renew are now recorded in the relationship history log',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Diplomacy: editing a relationship no longer fails with a "Validation error" — all form fields (contact info, dates, review dates, expiry, visibility, auto-renew) are now accepted by the server',
        ],
      },
    ],
  },
  {
    version: '2026.04.78',
    date: '2026-04-08',
    title: 'Audit Flags & Watchlist Display Fix',
    highlights: [
      'Audit flags and watchlist entries now display correctly — creating a manual flag or adding a watchlist entry updates the list immediately',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Audit Flags: the flag list no longer shows "No flags found" after creating a manual flag — flags appear immediately without a page refresh',
          'Watchlist: newly added watchlist entries now appear in the list right away instead of requiring a reload',
        ],
      },
    ],
  },
  {
    version: '2026.04.77',
    date: '2026-04-08',
    title: 'Intel & Watchlist Connectivity Fix',
    highlights: [
      'The Citizen Watchlist, Audit Flags, and Intel Vault pages now load correctly instead of showing rate limit errors',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Intel: Citizen Watchlist, Audit Flags, Member Profiles, and Intel Vault pages were returning "too many requests" errors instead of loading — this is now resolved',
          'Intel: adding, editing, and removing watchlist entries now works as expected',
        ],
      },
    ],
  },
  {
    version: '2026.04.76',
    date: '2026-04-08',
    title: 'SCStats Career Matching Fix',
    highlights: [
      'Flight Hours by Career and Org Skill Distribution now calculate correctly after importing ship data',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'SCStats: Flight Hours by Career now correctly matches your ships to their career types (Combat, Transport, Mining, etc.) instead of showing everything as "Unknown"',
          'SCStats: Organization Skill Distribution bars now populate correctly from imported ship data',
          'SCStats: Ship names from CSV exports (e.g. Starlifter C2, Star Runner, Lightning F8C) are now properly recognized and matched to the ship catalogue',
        ],
      },
    ],
  },
  {
    version: '2026.04.75',
    date: '2026-04-08',
    title: 'SCStats Public Analytics & Import Improvements',
    highlights: [
      'Organization SCStats analytics now load correctly on public profiles',
      'CSV import handles more edge cases and shows better error messages',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'SCStats: public organization analytics now load correctly — previously the page showed a loading error due to an incorrect API URL',
          'SCStats: CSV import shows clearer error messages when the file format is unexpected',
        ],
      },
      {
        category: 'improved',
        items: [
          'Recruitment Apply dialog polished with better field layout and validation feedback',
          'Organization directory cards show RSI tags when available',
        ],
      },
    ],
  },
  {
    version: '2026.04.74',
    date: '2026-04-08',
    title: 'Flexible SCStats Imports & Career Breakdown',
    highlights: [
      'Import SCStats CSV files one category at a time — no need to upload everything at once',
      'See your flight hours broken down by ship career on the SCStats page',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'SCStats now supports partial uploads — import just your Ships, Playtime, or any combination of categories and add the rest later',
          'Category status chips show which data sets (Playtime, Loadout, Purchases, Ships) have been imported',
          'Flight hours by career breakdown shows your gameplay profile across Combat, Transport, Exploration, and more',
          'Purchase and loadout statistics (items bought, aUEC spent, primary weapon) are now displayed when imported',
        ],
      },
      {
        category: 'improved',
        items: [
          'Re-importing a category replaces only that data — other categories you previously uploaded remain untouched',
        ],
      },
    ],
  },
  {
    version: '2026.04.73',
    date: '2026-04-08',
    title: 'Recruitment Questions & Membership Accuracy',
    highlights: [
      'Recruitment application forms now show the correct questions for each post',
      'The Apply button in the directory accurately reflects your membership across all organizations',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Applying to a recruitment post now shows the recruitment-specific questions instead of only the organization-level ones',
          "If a recruitment post has no custom questions, the organization's application form questions are used as a fallback",
          'The Apply button on organization cards now correctly shows "Member" even when the organization is not your currently active one',
        ],
      },
    ],
  },
  {
    version: '2026.04.72',
    date: '2026-04-08',
    title: 'Discord Recruitment Integration & Cleaner Activity Feeds',
    highlights: [
      'Connect your Discord server to recruitment so applicants can apply directly through Discord',
      'Recruitment posts no longer clutter the Activities page — they live on their own dedicated page',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Discord Recruitment: enable Discord integration in Discord Settings to connect your recruitment pipeline to your Discord server',
          'Discord Recruitment: set an Approved Role, Pending Role, Application Channel, and Welcome Message to automate your onboarding flow',
          'Discord Recruitment: when enabled with an invite URL, the Apply button on your recruitment posts redirects applicants to your Discord server',
          'Auto-resolution: when a member receives the Approved Role in Discord, their pending application is automatically accepted — removal auto-rejects',
          'Invite Form Binding: require applicants to fill out your application form before granting Discord server access',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Recruitment posts no longer appear on the Activities page, recommended activities, upcoming activities, or search results — they have their own dedicated Recruitment page',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord Settings recruitment tab now saves all fields to the server and loads them on page refresh',
          'Discord invite URL is validated to only accept discord.gg and discord.com links for security',
        ],
      },
    ],
  },
  {
    version: '2026.04.71',
    date: '2026-04-08',
    title: 'Applicant Profiles & Dynamic Skill Distribution',
    highlights: [
      'Recruitment applicants now show their skills and flight hours so you can evaluate experience at a glance',
      'Organization cards and dashboards display member skill distribution by ship career — Combat, Mining, Medical, Salvaging, Capital Crew, and more',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Recruitment: expanding an applicant row reveals their skills (with level) and flight hours broken down by ship career',
          'Organization cards in the directory now show compact skill distribution bars for member experience by career',
          'Organization profile dashboard shows the full skill distribution for all careers',
        ],
      },
      {
        category: 'improved',
        items: [
          'Skill categories are now derived from the ship catalogue — every ship career is automatically included without manual configuration',
          'Ship careers are mapped to meaningful labels: Starter ships are grouped under their actual role, Industrial splits into Mining vs Salvaging, Support identifies Medical, large combat ships show as Capital Crew',
          'Competition ships show as Racing, Ground vehicles as Driving, and Transporter as Hauling',
          'Members are bucketed by flight hours: under 50h (Low), 50–199h (Medium), 200–499h (High), 500h+ (Expert)',
          "Skill distribution respects each organization's privacy settings — only shown when the org has enabled skill visibility",
        ],
      },
    ],
  },
  {
    version: '2026.04.70',
    date: '2026-04-08',
    title: 'Hangar Description Column',
    highlights: ['Your Personal Hangar table now shows the Description you set on each ship'],
    changes: [
      {
        category: 'added',
        items: [
          'Personal Hangar: a new Description column appears between Custom Name and Status so you can see your ship notes at a glance',
          'Personal Hangar: long descriptions are truncated — hover or focus the text to read the full note',
        ],
      },
    ],
  },
  {
    version: '2026.04.70',
    date: '2026-04-08',
    title: 'Unified Fleet Crew View & Richer Audit Log',
    highlights: [
      'The Crew tab now shows everything about each ship in one place — crew readiness, assigned members, and position selection',
      'The Fleet Audit Log now shows detailed descriptions for all events including ship changes, member joins/leaves, and position updates',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Fleet Crew: each ship now has a single unified bar showing crew fill status, readiness gates, assigned crew members with roles, and your position selection — no more scrolling between two separate sections',
          'Fleet Crew: your current assignment and the team join policy are shown at the top for quick reference',
          'Fleet Audit Log: ship add/remove events now show the ship name (e.g., "Added ship Arrow")',
          'Fleet Audit Log: member join and leave events show who joined or left and which ship',
          'Fleet Audit Log: position changes, gate status updates, team deletions, and bulk ship adds now all have descriptive text',
          'Fleet Audit Log: each event type has a distinct icon — ships, members, positions, and gates are all visually distinguished',
        ],
      },
    ],
  },
  {
    version: '2026.04.69',
    date: '2026-04-08',
    title: 'Recruitment Application Form & Org Card Integration',
    highlights: [
      "Applying to a recruitment post now shows the organization's custom application questions",
      'Organization cards in the directory show active recruitment info and let you apply directly',
    ],
    changes: [
      {
        category: 'added',
        items: [
          "Recruitment: clicking Apply on a recruitment post now opens a full application form with the organization's custom questions from Organization Settings",
          'Recruitment: the form supports all question types — short answer, paragraph, dropdown, checkbox, and rules acceptance',
          'Recruitment: organization cards in the public directory now display the active recruitment post title, roles needed, and positions filled',
          'Recruitment: clicking Apply on an org card with an active recruitment opens the recruitment application form instead of the generic join dialog',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Recruitment: creating a recruitment post no longer counts the creator as a position filled — the count now starts at 0',
          'Recruitment: the Apply button shows "Member" and is disabled when you are already a member of the organization',
        ],
      },
    ],
  },
  {
    version: '2026.04.68',
    date: '2026-04-08',
    title: 'Image Upload Fix',
    highlights: [
      'Banner image uploads now work on Recruitment, Federation, and Diplomacy pages',
      'Upload errors show what went wrong instead of a generic failure message',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Image Upload: banner images on Recruitment posts, Federation settings, and Diplomacy incident reports now upload and save correctly',
          'Image Upload: uploading a banner no longer fails silently — if something goes wrong, you see the actual error message',
          'Image Upload: uploaded images are stored permanently in Azure cloud storage and will not expire like Discord or other temporary links',
          'Diplomacy: screenshot uploads on incident reports now reach the correct server endpoint',
        ],
      },
    ],
  },
  {
    version: '2026.04.67',
    date: '2026-04-08',
    title: 'Recruitment Applicant Management',
    highlights: [
      'View and manage applicants for each recruitment post from the Recruitment page',
      'Accept or reject applications directly — rejected applicants can include a reason',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Recruitment: new Applicants tab lets you select a recruitment post and see everyone who applied, with status filters and expand-for-details',
          'Recruitment: accept or reject applications in one click — you can add an optional reason when rejecting',
          'Recruitment: expanded applicant rows show RSI handle, Discord ID, timezone, playtimes, screening score, and answers',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Recruitment: the Applicants tab previously showed organization join requests rather than recruitment post applications — it now shows the correct data',
        ],
      },
    ],
  },
  {
    version: '2026.04.66',
    date: '2026-04-08',
    title: 'Activity Sort Fix & Intel Vault Fix',
    highlights: [
      'Activity search sorting now works correctly — you can sort by start date, title, status, or type',
      'Intel vault entry listing fixed for organizations that were seeing a loading error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Activity Search: sorting by date, title, status, or type now takes effect instead of silently defaulting to newest first',
          'Intel Vault: the entries page no longer returns an error for some organizations',
        ],
      },
    ],
  },
  {
    version: '2026.04.65',
    date: '2026-04-08',
    title: 'Citizen Watchlist, Activity Filters & Discord Matching',
    highlights: [
      'The intel watchlist now tracks individual players instead of organizations — add citizens by RSI handle with threat levels',
      'Cancelled activities are hidden by default and recruitment posts have moved to their own page',
      'Member intel now matches RSI handles against Discord guild member names to auto-link accounts',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Intel: citizen watchlist lets you track individual RSI players with threat levels and reasons (hostile, griefer, spy, etc.)',
          'Intel: member matching now checks Discord guild nicknames, display names, and usernames to find unlinked RSI members',
          'SCStats: flight hours are now broken down by ship career (Combat, Transport, Exploration, etc.)',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Activities: cancelled events are hidden by default — use the Status filter to show them when needed',
          'Activities: recruitment posts no longer appear on the Activities page — find them on the dedicated Recruitment page instead',
          'Intel: access denied errors now return a proper 403 response instead of a generic server error',
        ],
      },
      {
        category: 'improved',
        items: [
          'Diplomacy: the watchlist has moved from the Diplomacy page to the Intel section where it fits better',
          'Intel: tentative member links from Discord matching are flagged for review so officers can verify them',
        ],
      },
    ],
  },
  {
    version: '2026.04.64',
    date: '2026-04-07',
    title: 'Recruitment Form Fixes & Admin Login',
    highlights: [
      'Recruitment create and edit forms no longer close on errors — you can now see and fix issues before retrying',
      'Admin login page redesigned with a cleaner layout and better error handling',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Recruitment: creating or editing a post no longer closes the form if an error occurs — the error message stays visible so you can fix and retry',
          'Fleet Health: crew status queries now work correctly with readonly status constants',
        ],
      },
      {
        category: 'improved',
        items: [
          'Admin Login: redesigned with a cleaner form layout and improved error display',
          'Admin account setup documentation updated with current instructions',
        ],
      },
    ],
  },
  {
    version: '2026.04.63',
    date: '2026-04-07',
    title: 'Fleet Crew Gate Fix',
    highlights: ['Crew gate indicators now correctly reflect your actual ship assignments'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fleet Crew Panel: Lean and Conservative gate chips now clear when crew members select a ship position',
          'Fleet Crew Panel: per-ship crew counts accurately show who is assigned to each ship instead of estimating',
        ],
      },
    ],
  },
  {
    version: '2026.04.62',
    date: '2026-04-07',
    title: 'Activity Detail Improvements & Security Hardening',
    highlights: [
      'Activity detail page now displays crew role assignments alongside member avatars',
      'Recruitment posts support additional metadata for better discoverability',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Activity Detail: crew positions and roles are now displayed per member',
          'Recruitment: posts can include additional classification data',
          'Directory: organization listing search is faster and more accurate',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Activity sorting is now protected against invalid sort parameters',
          'Recruitment metadata handling improved for edge cases',
        ],
      },
    ],
  },
  {
    version: '2026.04.61',
    date: '2026-04-07',
    title: 'Recruitment Search, Filters & New Tag',
    highlights: [
      'Find the right organization faster with search, status filters, and tag filters on the Recruitment page',
      'New "Semi Casual" playstyle tag for recruitment posts',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Recruitment: search bar to find posts by title or description',
          'Recruitment: filter by status (Open, Paused, Closed)',
          'Recruitment: filter by tags — select one or more focus, playstyle, or exclusivity tags to narrow results',
          'Recruitment: "Has Open Slots" toggle to show only posts with available positions',
          'Recruitment: new "Semi Casual" playstyle tag',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Recruitment: creating a post without a banner image no longer shows a validation error',
        ],
      },
    ],
  },
  {
    version: '2026.04.60',
    date: '2026-04-07',
    title: 'Profile Pictures in Activity Details',
    highlights: [
      'Participant and crew member avatars now display in activity details instead of generic placeholders',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          "Activities: participant lists and ship crew sections now show each member's profile picture",
          'Activities: avatars load efficiently in a single request — no extra loading time',
        ],
      },
    ],
  },
  {
    version: '2026.04.59',
    date: '2026-04-07',
    title: 'Verified Badge Fix for RSI-Verified Organizations',
    highlights: [
      'Organizations that completed RSI verification now correctly display the Verified badge on their directory profile',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Directory: organizations that completed RSI verification (by rank or by code) now correctly show the "Verified" badge on their profile page and in search results',
          'Directory: existing verified organizations will receive their badge automatically on the next RSI sync',
        ],
      },
    ],
  },
  {
    version: '2026.04.58',
    date: '2026-04-07',
    title: 'Ship Descriptions, Recruitment Overhaul & Platform Stats',
    highlights: [
      'Add a description to any ship in your hangar — notes on loadout, purpose, or backstory',
      'Recruitment management redesigned with dedicated cards, detail pages, and preview mode',
      'Platform Stats page with live counts and version info',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Personal Hangar: ships now have an optional Description field — add notes about your loadout, mission role, or ship backstory',
          'Recruitment: redesigned with card-based listing and a full detail page for each recruitment post',
          'Recruitment: preview button lets you see how your post looks to applicants before publishing',
          'Platform Stats: new page showing live platform-wide counts and build version',
          'Ship picker: unreleased ships (In Concept, In Production) shown greyed out with a status label',
        ],
      },
      {
        category: 'improved',
        items: [
          'Organization Ships: fleet statistics now include a production status indicator per ship',
        ],
      },
    ],
  },
  {
    version: '2026.04.57',
    date: '2026-04-07',
    title: 'Apply Button & Member Detection Fix',
    highlights: [
      'The Apply button on organization cards now correctly shows "Member" when you already belong to the organization',
      'Custom application questions from your org settings are now shown in the application form',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Directory: the Apply button now correctly shows "Member" (disabled) for organizations you already belong to — previously it showed "Apply" even for your own org',
          'Organization Applications: when your org has custom application questions configured in settings, applicants now see those questions instead of the default form',
        ],
      },
    ],
  },
  {
    version: '2026.04.56',
    date: '2026-04-07',
    title: 'RSI Organization Verification — Verify by Rank',
    highlights: [
      'Founders, Officers, and 5-star members can now verify their RSI organization instantly — no verification code needed',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'RSI Org Verification: new "Verify by Rank" option lets you verify your organization instantly if you are a Founder, Officer, or have a 5-star rank on the RSI page',
          'RSI Org Verification: when creating an organization, choose between "Verify by Rank" (instant) or "Verify by Code" (add a code to your RSI org page)',
          'RSI Org Verification: the code-based method is still available for members whose rank is not high enough for instant verification',
        ],
      },
    ],
  },
  {
    version: '2026.04.55',
    date: '2026-04-07',
    title: 'Application Form — Custom Questions & Member Guard',
    highlights: [
      'Organizations that set up custom application questions now see those questions in the apply form',
      'Members of an organization can no longer see an active Apply button',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Organization Applications: the apply form now shows the custom questions configured in org settings instead of hardcoded default fields',
          'Directory & Profile: the Apply button is disabled and shows "Member" when you already belong to the organization',
        ],
      },
    ],
  },
  {
    version: '2026.04.54',
    date: '2026-04-07',
    title: 'Recruitment — Banner Upload & Duplicate Apply Prevention',
    highlights: [
      'Upload banner images directly from your computer — no more broken Discord links',
      'The Apply button now tells you when you have already applied',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Recruitment: upload a banner image from your computer (PNG, JPEG, WebP, up to 5 MB) — the image is stored permanently and will not expire like Discord or external links',
          'Recruitment: you can still paste a URL instead if you prefer',
          'Recruitment: the Apply button shows "Applied" and is disabled once you submit your application or if you have already applied',
          'Recruitment: attempting to apply again shows a friendly "You have already applied" message instead of an error',
        ],
      },
      {
        category: 'fixed',
        items: [
          'RSI org verification now fetches the latest page content instead of a cached version, so the verification code you just added is found immediately',
        ],
      },
    ],
  },
  {
    version: '2026.04.53',
    date: '2026-04-07',
    title: 'RSI Org Verification — Founder & High-Rank Recognition',
    highlights: [
      'Founders and high-ranking members can now verify their RSI organization without being incorrectly rejected',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'RSI org verification now recognizes Founders, Board Members, Directors, and Executive Officers — previously only exact rank names were accepted, so custom or compound titles were rejected',
          'Star-level detection improved to handle different RSI page layouts, reducing false "insufficient rank" errors',
          'Clearer error messages explain why verification failed: "not a member" vs "rank too low" with guidance on making your RSI profile publicly visible',
        ],
      },
    ],
  },
  {
    version: '2026.04.52',
    date: '2026-04-07',
    title: 'Collapsible Fleet Statistics',
    highlights: ['Hangar and fleet statistics can now be collapsed to focus on the ship list'],
    changes: [
      {
        category: 'improved',
        items: [
          'Personal Hangar: breakdown chips and distribution charts can be collapsed by clicking the "Fleet Statistics" header',
          'Organization Ships: breakdown, distribution charts, and ownership chart can be collapsed — the summary counters remain visible',
        ],
      },
    ],
  },
  {
    version: '2026.04.51',
    date: '2026-04-07',
    title: 'Recruitment — Banner Image Error Handling',
    highlights: [
      'Banner images on recruitment posts now gracefully hide if the image URL is broken or unavailable',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Recruitment: banner images that fail to load (e.g. removed or unavailable URLs) are now hidden instead of showing a broken image placeholder',
        ],
      },
    ],
  },
  {
    version: '2026.04.50',
    date: '2026-04-07',
    title: 'Application Forms — Apply Directly from Directory & Job Listings',
    highlights: [
      'Apply to organizations directly from the directory card — no need to open the profile page first',
      "Job listings now show the organization's custom application questions so you can fill them in when applying",
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Directory: clicking "Apply" on an organization card now opens the application form right away — with custom questions, Discord redirect, or a simple message, depending on how the org is configured',
          'Job Listings: when you apply for a job listing posted by an organization, any custom application questions set by that org are shown alongside the message field',
        ],
      },
      {
        category: 'improved',
        items: [
          'Applying to an organization is now faster — you can submit your application without navigating away from the directory',
        ],
      },
    ],
  },
  {
    version: '2026.04.49',
    date: '2026-04-07',
    title: 'Recruitment Posts — Rich Formatting, Banners & Org Logos',
    highlights: [
      'Recruitment posts now support Markdown formatting — use bold, lists, links, and more to make your post stand out',
      'Add a banner image to your recruitment post for a polished, professional look',
      'Organization logos now appear on recruitment cards so applicants can identify your org at a glance',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Recruitment: Markdown editor for descriptions and requirements — supports bold, italic, headings, lists, links, and code blocks',
          'Recruitment: optional banner image displayed as a wide header at the top of each post',
          'Recruitment: organization logo shown next to the post title, with a letter fallback when no logo is set',
        ],
      },
      {
        category: 'improved',
        items: [
          'Recruitment: description and requirements now support up to 5,000 characters (previously 2,000) to accommodate formatted content',
          'Recruitment: the editor shows a formatting toolbar with live preview so you can see how your post will look before publishing',
        ],
      },
    ],
  },
  {
    version: '2026.04.48',
    date: '2026-04-07',
    title: 'Fleet Detail Loading Fix',
    highlights: [
      'Fleet health, ships list, and crew members now load correctly instead of showing an error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fleet health panel no longer shows an unexpected error when viewing fleet details',
          'Fleet ships list loads correctly — previously could show a server error on some fleets',
          'Fleet crew members tab no longer fails to load with an internal error',
          'When a fleet is not found, the correct "not found" message is shown instead of a generic server error',
        ],
      },
    ],
  },
  {
    version: '2026.04.47',
    date: '2026-04-07',
    title: 'Fleet Data Accuracy & RSI Verification Messages',
    highlights: [
      'Organization Ships breakdowns now include member-shared ships — charts reflect your full fleet',
      'Personal Hangar summary loads reliably — no more blank stats or missing charts',
      'RSI organization verification shows clear error messages instead of generic failures',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fleet Operations: career, role, size, and manufacturer breakdowns now include all member-shared ships — previously only org-owned ships were counted',
          'Personal Hangar: ship summary no longer fails to load — stat cards and breakdown charts display correctly',
          'Personal Hangar: users with multiple copies of the same ship now see correct breakdown counts',
          'Personal Hangar: Operational, Needs Repair, and Shared with Org stats show a dash instead of misleading numbers when data is temporarily unavailable',
          'RSI org verification now tells you exactly why it failed instead of a generic error',
          'RSI org verification page shows the actual API error message on failure',
          'When RSI services are temporarily down, a clear "try again later" message is shown',
        ],
      },
    ],
  },
  {
    version: '2026.04.46',
    date: '2026-04-07',
    title: 'Personal Hangar Stats & Charts',
    highlights: [
      'Hangar stat cards now show totals across all your ships, not just the current page',
      'New distribution charts: ships by status, condition, and visibility',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Personal Hangar: ships by status, condition, and visibility pie charts — visible even when ship catalog data is unavailable',
          'Fleet Operations: career, role, and size distribution charts now shown on the organization ships page',
          'Fleet Operations: ownership breakdown chart showing org-owned vs member-owned ship counts',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Personal Hangar: Operational, Needs Repair, and Shared with Org counts now reflect all ships, not just the current page',
          'Personal Hangar: chart colours now follow the application theme instead of using hardcoded values',
          'Personal Hangar: chart labels formatted consistently (e.g. "Sub Capital" instead of "Sub_capital")',
        ],
      },
    ],
  },
  {
    version: '2026.04.45',
    date: '2026-04-07',
    title: 'Organization Membership Fix',
    highlights: [
      'Fixed an issue where leaving an organization could fail with a "not found" error',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Leaving an organization no longer fails with a 404 error — inactive memberships are now correctly filtered from the organization list',
        ],
      },
    ],
  },
  {
    version: '2026.04.44',
    date: '2026-04-07',
    title: 'RSI Org Verification Fix',
    highlights: [
      'RSI organization verification now actually checks your RSI org page instead of auto-approving',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'RSI organization verification now performs real verification — previously it always reported success without checking the RSI website',
          'Verification failure now shows a clear error message and lets you retry instead of incorrectly marking the org as verified',
          'RSI verification is now more secure and reliable',
        ],
      },
    ],
  },
  {
    version: '2026.04.43',
    date: '2026-04-06',
    title: 'Job Listings, Security & Quality of Life',
    highlights: [
      'Ship distribution pie charts on Personal Hangar and Organization Ships pages',
      'Job listings now show fleet stats — total SCU and average quantum fuel at a glance',
      'Listing owners can cancel active job postings directly from the preview modal',
      'Account lockout protection strengthened against rapid login attempts',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Job listing fleet stats bar: total SCU and average quantum fuel shown in the preview modal when ship breakdowns include cargo or QF data',
          'Cancel job listing: owners can deactivate their listing from the preview modal without deleting it',
          'Leave organization: members can leave an org from the org switcher dropdown — ownership transfer is required before an owner can leave',
          'Ship distribution pie charts on Personal Hangar and Organization Ships — career, role, and size donut charts give a visual breakdown of your fleet at a glance',
          'Shared organization search with RSI SID fallback, reused across Diplomacy and Federation pages',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Account lockout now handles rapid concurrent login attempts more reliably',
          'Account recovery is now faster and more resistant to abuse',
          'Disabling 2FA via account recovery now requires proper verification',
          'Account recovery process hardened against information disclosure',
          'Leave organization notification now shows your display name correctly',
          'RSI verification status now displays correctly in all cases',
          'RSI verification instructions updated — code can be placed in Introduction, History, Manifesto, or Charter (not just description)',
          'RSI org verification now searches all page sections (Introduction, History, Manifesto, Charter) for the code',
          'Ship names now matched correctly regardless of capitalization when calculating fleet stats',
          'Login security improvements for Azure AD authentication',
        ],
      },
      {
        category: 'improved',
        items: [
          'Role mapping: RSI Rank dropdown now always shows all 6 star levels (0–5) even when some have no members yet',
          'RSI member intel card layout improved on wider screens',
          'Organization search in relations and federation pages is now more consistent',
          'Job listing public cards show SCU and quantum fuel specs per ship',
          'Ship distribution charts now shared between Personal Hangar and Organization Ships pages',
          'Job preview modal redesigned for clarity',
        ],
      },
    ],
  },
  {
    version: '2026.04.42',
    date: '2026-04-06',
    title: 'Activity Feed & Stability',
    highlights: [
      'Activity feed bookmarks now stay manageable — oldest entries auto-trimmed past 200',
      'Bookmark button no longer accidentally triggers the event click behind it',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Activity feed bookmarks automatically trimmed to 200 to keep the app responsive',
          'Bookmark button in the activity feed no longer accidentally triggers the event click',
        ],
      },
    ],
  },
  {
    version: '2026.04.41',
    date: '2026-04-06',
    title: 'RSI Affiliate Detection & Profile Improvements',
    highlights: [
      'RSI member intel now shows all affiliate organizations — not just the main org',
      'Hidden or private RSI orgs are clearly flagged instead of silently missing',
      'After every RSI sync, member data is automatically enriched and audited',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'RSI affiliate organizations now detected correctly — all orgs a citizen belongs to are shown',
          'Hidden or private RSI organizations display a clear "Hidden" indicator instead of appearing blank',
          'Duplicate organization entries no longer appear when a citizen is listed on multiple RSI pages',
          'Hangar breakdown chips now include imported ships that were added without a catalog link',
          'RSI verification status updates instantly across all pages after verifying or removing your handle',
        ],
      },
      {
        category: 'improved',
        items: [
          'After every RSI sync, member data is automatically enriched with org affiliations, audited for issues, and role mappings are validated',
          'Manual RSI crawl refresh also triggers the full enrichment and audit pipeline',
          'Help Center FAQ updated with the latest RSI sync and enrichment documentation',
          'Profile page loads faster with streamlined internal code',
        ],
      },
    ],
  },
  {
    version: '2026.04.39',
    date: '2026-04-06',
    title: 'Discord Bot Simplification & RSI Intel Improvements',
    highlights: [
      'Bot commands are now flat — type /events, /lfg, /bounty directly instead of /activity events, /social lfg, /bountyhub board',
      'RSI member intel now detects hidden/private organizations',
      'RSI verification status updates instantly without page reload',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          '21 bot commands promoted to top-level — shorter, faster to type',
          '/schedule now includes conflict checking (conflicts, my subcommands)',
          'RSI crawler fetches both citizen profile and organizations pages for complete data',
          'Fleet ship breakdown now includes imported ships without catalog IDs',
        ],
      },
      {
        category: 'fixed',
        items: [
          '/attendance history, leaderboard, and report subcommands were unreachable — now working',
          'Poll button interactions and embed modal submissions route correctly',
          'RSI member intel shows warning chip when primary org is hidden/private on RSI',
          'RSI verification status refreshes immediately after verify/unverify',
        ],
      },
    ],
  },
  {
    version: '2026.04.38',
    date: '2026-04-06',
    title: 'Activity Crew Positions, SCU Bars & Ticket Routing',
    highlights: [
      'Join activities as crew — pick a ship and open position to fill',
      'Ship cards show SCU cargo and quantum fuel capacity bars',
      'Participant avatars displayed on activity detail',
      'Tickets can now be routed to specific role groups (leadership, officers, teams)',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Crew position join mode — select a specific ship and role when joining an activity',
          'SCU and quantum fuel progress bars on activity ship cards',
          'Participant avatar display on activity detail page',
          'Ticket recipient types — route to org leadership, officers, team leaders, HR, recruitment, diplomacy, or specific users',
        ],
      },
      {
        category: 'improved',
        items: [
          'Join activity dialog now has 3 modes: as crew, with ship, or crew a position',
          'Cargo bars show total SCU + vehicle SCU with tooltips',
        ],
      },
    ],
  },
  {
    version: '2026.04.37',
    date: '2026-04-06',
    title: 'RSI Role Mapping — Complete Rank Coverage',
    highlights: [
      'RSI role mapping now includes all 9 standard RSI organization ranks',
      'Standard template updated with Board Member, Executive Officer, Senior, Associate, and Affiliate',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'RSI rank fallback list expanded from 4 to all 9 RSI ranks (Founder, Board Member, Director, Executive Officer, Senior, Member, Associate, Recruit, Affiliate)',
          'Standard role mapping template expanded from 5 to 9 tiers with correct RBAC permissions per rank',
        ],
      },
    ],
  },
  {
    version: '2026.04.36',
    date: '2026-04-06',
    title: 'Intel Vault Activation',
    highlights: [
      'Intel Vault entries, officers, and audit logs are now fully operational',
      'Create, read, update, and delete intel entries with classification-based access control',
      'Manage intel officers with rank-based permissions',
    ],
    changes: [
      {
        category: 'fixed',
        items: ['Intel entry creation now works correctly'],
      },
      {
        category: 'added',
        items: [
          'Full intel entry management — create, view, edit, and delete entries with encryption and classification',
          'Intel officer management — appoint, update, and remove officers',
          'Intel audit log with filtering',
        ],
      },
    ],
  },
  {
    version: '2026.04.35',
    date: '2026-04-06',
    title: 'Activity Detail Enhancements — Ship Bars, Avatars & Crew Positions',
    highlights: [
      'Ship cards now show SCU cargo and quantum fuel capacity as visual bars',
      'Join Activity dialog supports choosing a specific crew position on a ship',
      'Crew members and participants display actual avatars',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'SCU cargo bar — visual bar showing cargo capacity on each ship card',
          'Quantum fuel bar — visual bar showing fuel capacity on each ship card',
          'Crew a Position — new join mode to pick a specific crew slot on a ship',
          'Participant avatars — real user avatars displayed in crew and participant lists',
        ],
      },
      {
        category: 'improved',
        items: [
          'Join Activity dialog now offers three clear options: Join as Crew, Join with Ship, or Crew a Position',
          'Joining an activity now saves your crew position and ship assignment',
        ],
      },
    ],
  },
  {
    version: '2026.04.34',
    date: '2026-04-06',
    title: 'Fleet Management Fixes',
    highlights: [
      'Fleet cards now correctly show ship and crew counts',
      'Overview breakdown chips and summary cards display accurate totals',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Ship and crew counts now populate correctly on fleet cards, overview chips, and summary cards',
          'Fleet data loads correctly even for older fleet records',
        ],
      },
      {
        category: 'improved',
        items: ['Cleaner fleet type display — small card chips show text labels without icons'],
      },
    ],
  },
  {
    version: '2026.04.33',
    date: '2026-04-06',
    title: 'Fleet Career Breakdown',
    highlights: [
      'Fleet Operations now shows breakdowns by ship size, career, and role',
      'Quickly see your fleet composition at a glance with color-coded chips',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Career breakdown — see how ships are distributed across combat, transport, industrial, exploration, and more',
          'Size and role breakdowns — view ship composition by size class and operational role',
          'Click any breakdown chip to filter the ship table by that category',
        ],
      },
    ],
  },
  {
    version: '2026.04.32',
    date: '2026-04-06',
    title: 'Ticket System Fix',
    highlights: ['Fixed a server error that prevented the tickets page from loading'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Ticket list no longer returns a 500 error when filtering by status',
          'Added support for ticket recipient type routing',
        ],
      },
    ],
  },
  {
    version: '2026.04.31',
    date: '2026-04-05',
    title: 'Team Voice Channels & Discord Integration',
    highlights: [
      'Teams now get dedicated Discord channels — a category, text channel, and voice channel created automatically',
      'Configurable voice settings — user limit, bitrate, push-to-talk, priority speaker',
      'Team channels are automatically cleaned up when teams are deleted',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Team voice channels — each team gets a Discord category with text and voice channels',
          'Auto-provisioning — channels created when teams are created (configurable per guild)',
          'Auto-cleanup — channels and roles deleted when teams are removed',
          'Configurable settings — name template, user limit, bitrate, push-to-talk enforcement',
          'Priority speaker — team leaders get priority speaker in voice channels',
        ],
      },
      {
        category: 'improved',
        items: [
          'Team member additions/removals automatically update Discord channel permissions',
          'Fleet list panel improvements',
        ],
      },
    ],
  },
  {
    version: '2026.04.29',
    date: '2026-04-05',
    title: 'RSI Role Mapping Fix & Dashboard Improvements',
    highlights: [
      'RSI role mapping re-creation fixed — deleting and re-adding mappings no longer causes errors',
      'Member profile drawer shows which Discord server was checked for role verification',
      'Dashboard organization stats improved',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'RSI role mapping re-creation — deleting a mapping and creating a new one with the same rank no longer fails',
          'Discord guild context now shows in member audit profile — see which server was checked',
        ],
      },
      {
        category: 'improved',
        items: [
          'Role mapping panel is easier to use',
          'RSI member intel cards show more detail',
          'Dashboard organization statistics are more accurate',
          'Discord settings page layout improvements',
          'Hub sidebar navigation is clearer',
        ],
      },
    ],
  },
  {
    version: '2026.04.28',
    date: '2026-04-04',
    title: 'RSI Sync Fix, Verified Role & Profile Slugs',
    highlights: [
      'RSI org member sync now correctly crawls all members — rank discovery and metrics work again',
      'Verified Discord role — the bot auto-assigns a "\u2705 Verified" role when you complete RSI verification',
      'Profile URLs now use your username instead of a UUID — e.g. /profile/Fintz',
      'Auto-reload on updates — the app detects new deployments and refreshes automatically',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Verified Discord role — your bot auto-assigns a "\u2705 Verified" role when members complete RSI verification',
          '/rsisync verified command — admins can configure or pick an existing role for the verified badge',
          'Verified role is automatically removed when RSI verification is revoked',
          'The app now auto-reloads when a new version is deployed — no more stale pages',
          '"New Version Available" message shown when the app detects an update',
        ],
      },
      {
        category: 'fixed',
        items: [
          'RSI member sync now correctly identifies all org members — handles, ranks, stars, and affiliate status all show up',
          'Manual syncs now pull fresh data from RSI instead of showing stale results',
          'Member Audit profile drawer no longer shows a "data is undefined" error',
          'RSI members are now auto-linked to platform users — no more false "Not Linked" status',
          'Member profile drawer shows your username instead of a UUID',
          'RSI Presence section works for verified users even without a formal sync link',
          'Discord presence falls back gracefully when a sync link is missing',
        ],
      },
      {
        category: 'improved',
        items: [
          'Profile URLs now use your username — /profile/Fintz instead of /profile/UUID',
          'Profile, ships, and activity pages work with both username and UUID in the URL',
          'RSI sync runs less frequently (every 15 minutes instead of every minute) to reduce server load',
        ],
      },
    ],
  },
  {
    version: '2026.04.27',
    date: '2026-04-04',
    title: 'Ship Careers, PWA Updates & Fleet Statistics',
    highlights: [
      'Ships now have a career field — Combat, Transport, Industrial, Exploration, Medical, and more',
      'Sub-capital ship size added for vessels like the Polaris',
      'App update banner — get notified when a new version is available',
      'Fleet statistics show career breakdown alongside role and size',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Ship career field — classify ships by purpose: Combat, Transport, Industrial, Exploration, Medical, and more',
          'Sub-capital ship size — a new category for large non-capital ships like the Polaris and Idris-P',
          'App update banner — automatically detects new versions and prompts you to reload',
          'Fleet statistics now include a career breakdown — see fleet composition by ship career',
          'RSI org metadata on public profiles — archetype, commitment level, roleplay preference, and exclusivity',
          'Global search — find organizations, federations, and users from one search bar',
        ],
      },
      {
        category: 'improved',
        items: [
          'Ship import dialog now supports career and sub-capital size fields',
          'CSV import handles the new career column',
          'Fleet detail panel recognizes sub-capital ships',
          'User profile and privacy settings enhancements',
          'Federation management page improvements',
          'RSI member intel enriched with citizen org data',
          'Role mapping panel improved for the RSI sync workflow',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fleet listing no longer crashes with a "Cannot set property memberCount" error',
          'Discord bot command options are now in the correct order in /rsisync',
        ],
      },
    ],
  },
  {
    version: '2026.04.26',
    date: '2026-04-03',
    title: 'RBAC & Moderation Redesign',
    highlights: [
      'Role permissions are now fully customizable per organization',
      'New Flags & Audit tab — resolve, dismiss, and escalate member flags',
      'Full member roster table with inline role management and search',
      'Permission matrix — visual editor for role permissions',
      'Team-scoped permissions — control access at the team level',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Customizable role permissions — fine-tune what each role can do in your organization',
          'Flags & Audit tab on Members page — manage member flags with resolve, dismiss, and escalate actions',
          'Member roster table — search, filter by role, change roles inline, and remove members',
          'Permission matrix — visual checkbox grid to edit permissions by resource and action',
          'Effective permissions view — see the combined permissions from all sources for any member',
          'Team-scoped permissions — grant permissions at the team level, not just org-wide',
          'Auto-flag for unverified RSI members',
          'Enriched member roster — shows RSI handle, Discord ID, RSI verification status, registration date, and last login',
          'Team & crew columns in the member roster — see team name, role, rank, and ship crew assignments',
          '6-tier role hierarchy — Recruit \u2192 Member \u2192 Officer \u2192 Senior Officer \u2192 Admin \u2192 Founder',
          'Members by role view — accordion grouped by role with count badges',
        ],
      },
      {
        category: 'improved',
        items: [
          'Members page now has 4 tabs: Members, Permissions, Roles, and Flags & Audit',
          'Full roster table shown above the application and invitation panels',
          'Role permission dialog uses a visual matrix grid instead of a flat checkbox list',
          'Teams now have a join policy — open (anyone joins) or closed (approval required)',
          'Fleet crew members panel — view and manage crew assigned to fleet ships',
        ],
      },
    ],
  },
  {
    version: '2026.04.25',
    date: '2026-04-03',
    title: 'Fleet Crew Positions, Audit Log, Maintenance & Statistics',
    highlights: [
      'Assign crew members to specific ships with named roles (pilot, copilot, turret gunner, engineer)',
      'Fleet audit log — see all fleet changes with event type filtering',
      'Fleet maintenance panel — schedule and track maintenance cycles',
      'Fleet statistics — ship type, role, and status breakdowns',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Crew position selector — assign members to ships with named roles like pilot, copilot, gunner, or engineer',
          'Fleet audit log — view fleet change history with event type filtering',
          'Fleet maintenance panel — schedule and track fleet maintenance cycles',
          'Fleet statistics panel — ship type, role, and status breakdowns with charts',
        ],
      },
      {
        category: 'improved',
        items: [
          'Fleet crew panel shows per-ship position assignments',
          'Fleet health calculations factor in crew position fill rates',
          'Fleet detail panel reorganized with new tab layout',
          'Alliance manage page now uses clean URL slugs instead of UUIDs',
          'Alliance manage page has grouped sidebar navigation instead of a 19-tab horizontal bar',
          'Alliance settings support direct logo and banner upload with live preview',
        ],
      },
    ],
  },
  {
    version: '2026.04.24',
    date: '2026-04-03',
    title: 'Federation Association Types & Alliance Improvements',
    highlights: [
      'Federation members now have association types — full member, associate, observer, or treaty partner',
      'Organization profile shows federation affiliations with association badges',
      'Fleet tree view is faster with batch loading',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Federation association types — classify members as full member, associate, observer, or treaty partner',
          'Association type badges on federation management and organization profiles',
          'Change federation member association type from the manage page',
        ],
      },
      {
        category: 'improved',
        items: [
          'Fleet tree view loads much faster',
          'Federation directory shows association type breakdown for public federations',
          'Discord bot starts more reliably',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Alliance manage page no longer shows "Failed to load alliance data" error',
          'Federation features (ambassadors, intel vault, teams) now load correctly',
        ],
      },
    ],
  },
  {
    version: '2026.04.23',
    date: '2026-04-02',
    title: 'Fleet Capabilities & Ship Enrichment',
    highlights: [
      'Ships added to activities are now enriched with full data — SCU, fuel, hangar, crew',
      'Fleet cards show capability tags — refuel, rearm, repair — plus total SCU and average quantum fuel',
      'Alliance directory and manage page errors resolved',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Ship metadata auto-enrichment — cargo capacity, fuel stats, hangar size, manufacturer, and crew info pulled from the ship catalogue automatically',
          'Quantum fuel capacity shown on per-ship cards in activity detail',
          'Refuel / Rearm / Repair capability badges on ship cards when capability ships are present',
          'Fleet cards display total cargo (SCU), average quantum fuel, and capability badges',
          'Fleet-level cargo and fuel totals recalculate automatically when ships are added or loaned',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Alliance directory — names with special characters now match correctly',
          'Alliance card Contact and Apply buttons navigate correctly',
          'Private org members can now see the Manage button on alliance details',
          'Alliance manage page shows "session expired" instead of a generic error when your session ends',
        ],
      },
      {
        category: 'improved',
        items: [
          'Route calculation uses ship crew capacity as a fallback when catalogue data is unavailable',
        ],
      },
    ],
  },
  {
    version: '2026.04.22',
    date: '2026-04-02',
    title: 'Add Ships & Vehicles to Carriers',
    highlights: [
      'Ships with hangars or vehicle cargo now have buttons to add nested ships and vehicles directly',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Add Ship button on hangar-capable ships — nest smaller ships inside carriers',
          'Add Vehicle button on vehicle-carrier ships — load ground vehicles into cargo',
          'Ship search dialog with size filtering when adding ships to carriers',
        ],
      },
    ],
  },
  {
    version: '2026.04.21',
    date: '2026-04-02',
    title: 'Activity Card Fleet Preview',
    highlights: [
      'Activity cards now show ship requirements with count and fleet logistics at a glance',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Ship requirements section on activity cards — shows required and preferred ships with counts',
          'Fleet logistics row — total cargo capacity (SCU) and average quantum fuel per ship',
          'Refueling ship indicator — green badge when fleet includes a refueling-capable ship',
        ],
      },
    ],
  },
  {
    version: '2026.04.20',
    date: '2026-04-02',
    title: 'Alliance Diplomacy Fix',
    highlights: ['Alliance creation now works correctly'],
    changes: [
      {
        category: 'fixed',
        items: [
          'Alliance proposals no longer silently fail — the creation process works end to end',
          'Alliance types (trade, military, mutual defense, non-aggression, full alliance) are consistent everywhere',
          'Alliance approval now uses your authenticated identity automatically',
        ],
      },
    ],
  },
  {
    version: '2026.04.19',
    date: '2026-04-02',
    title: 'Job Listing Approved Vehicles',
    highlights: [
      'Approved ships from vehicle applications now appear on job listing cards and detail modals',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Approved vehicle badges on job listing cards — see ship name and applicant at a glance',
          'Approved Vehicles section in job detail modal with full vehicle list',
          'Ship info is saved to the listing when a vehicle application is approved',
        ],
      },
    ],
  },
  {
    version: '2026.04.18',
    date: '2026-04-02',
    title: 'Activity Ships & Crew Display + Reminder Fix',
    highlights: [
      'Required ships now display even when no crew is assigned yet',
      'Crew progress bar shows lean, conservative, and full thresholds with color coding',
      'Activity reminders with Discord channel no longer fail',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Required ship cards — unfilled ships show crew slots and a "Required — Unfilled" badge',
          'Role-based requirement cards — show role name, count, and awaiting status',
          'Crew gate bar — progress bar with lean (amber 40%) and conservative (blue 50%) threshold markers',
          'Color-coded crew fill level — red (below lean), amber, blue, green (full)',
          'Hover tooltip — see exact crew numbers for each threshold',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Activity reminders no longer fail with a 500 error when setting a Discord channel',
          'Ships & Crew section no longer shows empty when activity has required ships but no assignments',
          'Custom reminder type now works correctly',
        ],
      },
      {
        category: 'improved',
        items: [
          'Ship crew bar replaced with a richer gated bar showing lean/conservative/full color zones',
        ],
      },
    ],
  },
  {
    version: '2026.04.17',
    date: '2026-04-02',
    title: 'RSI Sync Member Intelligence',
    highlights: [
      'Full member intelligence cards with RSI data, Discord status, org affiliations, and active flags',
      'See what changed between sync runs — new members, removed members, and rank changes',
      'Automated audit — detect missing members, role mismatches, hidden profiles, and affiliate-only members',
      'Role mapping validation — cross-reference RSI ranks against Discord and internal roles',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Member Intelligence panel in Integrations tab with searchable member list',
          'Member Intel Card — composite view of RSI, Discord, web app, and flag data per member',
          "Enrich member — fetch a citizen's other RSI org affiliations on demand or in bulk",
          'Run Audit — auto-flag missing members, role mismatches, hidden profiles',
          "Validate Roles — check all members' Discord and internal roles against RSI rank mappings",
          '7 auto-generated flag types: Missing from RSI, Missing from Discord/Web App, Role Mismatch, Hidden RSI Member, Affiliate Not Primary',
          'Full member snapshot stored per sync for historical comparison',
          'Delta tracking — new/removed members and rank changes computed automatically each sync',
        ],
      },
      {
        category: 'fixed',
        items: ['Role Mapping Panel — better error messages for failed mapping queries'],
      },
    ],
  },
  {
    version: '2026.04.16',
    date: '2026-04-02',
    title: 'Alliance Management Fixes & Duplicate Name Guard',
    highlights: [
      'Alliance management page loads correctly again',
      'Private alliance members can view their federation details',
      'Alliance names must now be unique — duplicate names are rejected',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Duplicate alliance name guard — you can no longer create or rename an alliance to an already-taken name',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Alliance manage page no longer errors when loading federation data',
          'Private federation details page now works — members can view their own alliance info',
          'Browse Alliances button navigates to the correct page',
          'Alliance names are trimmed before saving to avoid leading/trailing space issues',
        ],
      },
    ],
  },
  {
    version: '2026.04.15',
    date: '2026-04-02',
    title: 'Fleet Hierarchy, Erkul Loadouts, RSI Role Mapping & Job Applications',
    highlights: [
      'Review job applications — approve, reject, or waitlist applicants from the job detail modal',
      'Fleet tree view — toggle between list and tree with drag-to-reorder',
      'Fleet statistics — role and size breakdown chips with click-to-filter',
      'Erkul loadout integration — paste an Erkul URL to import ship component data',
      'RSI role mappings update in real time',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Job application review — approve, reject, or waitlist applicants directly from the job detail modal',
          'Application status filters — filter by All, Pending, Approved, Rejected, Waitlisted, or Withdrawn',
          'Pending application count badge — see how many applications are waiting at a glance',
          'Fleet hierarchy — list/tree toggle with nested parent-child tree view',
          'Fleet reordering — drag-and-drop to reorder fleets within the tree view',
          'Fleet move dialog — move any fleet to a new parent',
          'Fleet breakdown — role and size breakdown chips on Fleet Operations and Personal Hangar',
          'Fleet statistics now show org vs. member ship counts, role, size, and manufacturer breakdowns',
          'Erkul Games loadout parsing — extract ship components from Erkul links',
          'RSI role mapping updates in real time when creating, editing, or deleting mappings',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Newly created alliances now appear correctly in the public directory',
          'Job application pending count badge shows the correct number with any filter active',
          'Passkey login now works correctly when using a custom API URL',
          'Passkey error messages are now user-friendly',
          'Fleet bulk add ships now works',
          'Shared loadout "Populate" button now works with Erkul.games URLs',
          'Federation creation now stores the correct founder organization name',
          'Crew assignments load correctly — no more 403 errors',
          'Permission-related 403 errors for crew assignments, invitations, and job applications resolved',
          'Dashboard sparkline graphs now trend in the correct direction',
          'Intel Vault pages load correctly',
        ],
      },
      {
        category: 'improved',
        items: [
          'Alliance creation is private by default — new toggle to list in the public directory',
          'After creating an alliance you are taken to the management page instead of the public directory',
          "Job application review panel auto-hides if you don't have management permissions",
          'Job preview modal shows more loadout and activity detail',
        ],
      },
    ],
  },
  {
    version: '2026.04.14',
    date: '2026-04-01',
    title: 'Global Search Now Active',
    highlights: [
      'Search (Ctrl+K) now finds organizations, federations, and users via live search',
      'Coming Soon pages no longer appear in search results',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Global search is now live — type 2+ characters to find organizations, federations, and users',
          'Disabled and Coming Soon pages (Trading, Inventory, Bounties, etc.) are filtered out of search results',
          'Search placeholder updated to "Search organizations, federations, and users..."',
        ],
      },
    ],
  },
  {
    version: '2026.04.13',
    date: '2026-04-01',
    title: 'Integrations Page, Member Enrichment & Role Mapping',
    highlights: [
      'Create RSI Sync schedules directly from the Integrations tab',
      'New Role Mapping panel for RSI \u2194 Discord \u2194 Web role alignment',
      'Member profile drawer enriched with Primary Org, Hidden/Redacted status, and Role Alignment checks',
      'View Intel button added to Members page',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'RSI Sync Schedule creation — set Organization SID and sync interval from Integrations tab',
          'Role Mapping Panel — view, create, edit, and delete RSI rank \u2192 Discord role mappings',
          'Member Profile enriched with Primary Org status, Hidden/Redacted indicators, and per-org rank',
          'Role Alignment section — shows RSI \u2192 Discord \u2192 Web role match/mismatch status',
          'View Intel button on Members page opens enriched member profile drawer',
        ],
      },
      {
        category: 'improved',
        items: [
          'Other RSI Orgs display shows Primary, Affiliate, and Hidden badges per organization',
          "Platform Memberships section highlights which org is the user's primary",
        ],
      },
    ],
  },
  {
    version: '2026.04.12',
    date: '2026-04-01',
    title: 'Fleet Permission Enforcement',
    highlights: [
      'Fleet operations now enforce role-based permissions — only authorized users can create, edit, or delete fleets',
      'Fleet creation no longer gets stuck when an error occurs',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Permission checks on all fleet operations — create, edit, delete, deploy, dissolve, manage members, and manage ships',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Fleet creation no longer gets stuck in "Creating..." state when an error occurs — you now see the error message',
          'Error messages from failed operations now display correctly instead of being silently swallowed',
          'Permission checks on fleet operations now work correctly',
        ],
      },
    ],
  },
  {
    version: '2026.04.11',
    date: '2026-04-01',
    title: 'Loadout Editing & Erkul Integration',
    highlights: [
      'Edit loadouts inline — update name, ship, description, URLs, and sharing in one dialog',
      'Paste an Erkul Games URL and auto-populate the ship name with one click',
      'Share loadouts with both organizations and federations',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Erkul Games URL "Populate" button — parses the URL and fills in the ship name automatically',
        ],
      },
      {
        category: 'improved',
        items: [
          'Loadout share button replaced with full Edit dialog — update all fields and sharing targets at once',
          'Sharing list now includes both organizations and federations',
          'Federation names display correctly in the "Shared with" summary',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Loadout list refreshes correctly after editing',
          'Federation names now resolve properly in the shared-with display',
        ],
      },
    ],
  },
  {
    version: '2026.04.10',
    date: '2026-04-01',
    title: 'Discord Bot Connectivity Fix',
    highlights: [
      'Discord bot commands no longer fail with connection errors',
      'Redis TLS support added for Azure deployments',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Discord bot commands (rsisync, fleet, org, diplomacy, recruitment, ticket) no longer fail with connection errors',
          'Bot connection to Azure Redis Cache now works with TLS',
        ],
      },
      {
        category: 'improved',
        items: ['Bot connectivity is more reliable when running alongside the web app'],
      },
    ],
  },
  {
    version: '2026.04.9',
    date: '2026-04-01',
    title: 'Dashboard Metrics, Inbox & Member Management',
    highlights: [
      'Dashboard now shows your personal ship count separately from the org fleet total',
      'Customizable summary cards — choose which metrics to display',
      'Inbox replies show sender name and avatar',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Dashboard summary cards show personal ships vs. org fleet count separately',
          'Customizable dashboard — hide or show individual summary cards via a settings toggle',
          'Inbox replies now display sender username and avatar',
          'Organization and alliance names shown in contact request details',
          'Member role updates work with all 9 organization roles',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Member roles always display correctly — no more missing roles',
          'Inbox unread count works correctly when no organization is selected',
        ],
      },
    ],
  },
  {
    version: '2026.04.8',
    date: '2026-04-01',
    title: 'Global Search & Public User Cards',
    highlights: [
      'Search for organizations, federations, and users from the top navigation bar',
      'New public user card for search results and directory displays',
      'Command palette (Ctrl+K) shows real search results',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Global search button in the top navigation bar with Ctrl+K shortcut',
          'Search across organizations, federations, and users from one place',
          'Public user card — displays avatar, display name, RSI badge, bio, org, ship count, and join date',
          'Command palette now shows live search results alongside commands',
        ],
      },
      {
        category: 'improved',
        items: [
          'Command palette shows grouped results — Commands and Search Results with avatars and type badges',
          'Keyboard navigation works across both commands and search results',
          'Only public-safe profile fields are returned in search results for privacy',
        ],
      },
    ],
  },
  {
    version: '2026.04.7',
    date: '2026-04-01',
    title: 'Activity Ship Count Labels',
    highlights: [
      'Activity detail now shows a "Ships" stat alongside Participants, Type, and Location',
      'Ships & Crew accordion displays total ship count in its title',
    ],
    changes: [
      {
        category: 'improved',
        items: [
          'Activity detail header shows a "Ships" stat column',
          'Ships & Crew accordion title now includes the ship count (e.g., "Ships & Crew (3)")',
          'Activity cards show a "Ships (N)" label above per-ship crew breakdowns',
        ],
      },
    ],
  },
  {
    version: '2026.04.6',
    date: '2026-04-01',
    title: 'Major Bug Fixes — Fleet, Auth, Ships & Security',
    highlights: [
      'Fleet creation now works — resolved 500 error',
      'Logout no longer logs you back in',
      'Member ships now load on the Fleet Operations page',
      'Security Settings 2FA toggle is now fully functional',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Fleet creation no longer fails with a 500 error',
          'Logging out no longer immediately logs you back in',
          'Member ships now load correctly on the Fleet Operations page',
          'Member role promotion no longer returns a 404 error',
          'Diplomatic relationship search no longer shows "undefined"',
          'RSI SID lookup no longer hangs — 10-second timeout added',
          'Ship catalogue loads correctly for large collections',
          'Ship roles page loads without errors',
          'Alliance creation shows specific field errors instead of a generic "Validation error"',
          'RSI sync trigger shows the actual error message (e.g., "No sync schedule configured")',
          'Active sessions list no longer shows expired sessions',
          'Job detail modal closes correctly',
          'Member ships now include pledged and gifted ships, not just owned',
          "Member role changes work even if the role doesn't exist yet for the organization",
          '"Join with Vehicle" is no longer always disabled on uncapped listings',
          'Alliance creation dialog no longer has focus trap issues',
          'Ship loadout creation works correctly',
          'Message detail now shows sender name, RSI handle, and Discord username',
          'Personal hangar Erkul link now uses the saved loadout URL',
          'Passkey login works correctly on the login page',
        ],
      },
      {
        category: 'improved',
        items: [
          'Security Settings — full 2FA management with setup, QR code, verify, and disable',
          'Login history — login events now recorded for password and OAuth logins',
          'Activity creation — LFG toggle renamed to "Quick Join (without approval)"',
          'Alliance creation form shows "At least 10 characters" helper text for description',
          'Member ships page now shows up to 100 ships by default',
          'Dashboard customize panel — reorder widgets with move up/down controls',
          'Help Center FAQ — added passkey login, step-up verification, alliances, and updated 2FA info',
        ],
      },
    ],
  },
  {
    version: '2026.04.5',
    date: '2026-04-01',
    title: 'Passkey Login & Step-Up Verification',
    highlights: [
      'Sign in with your passkey — Touch ID, Windows Hello, or a security key from the login page',
      'Destructive actions now require re-authentication when 2FA or passkeys are configured',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Passkey login — sign in with Touch ID, Windows Hello, or a security key without needing an OAuth provider',
          'Step-up verification — destructive actions require passkey or 2FA re-authentication',
          '"Sign in with Passkey" button on the login page',
        ],
      },
      {
        category: 'improved',
        items: ['Login page shows passkey option below OAuth providers with a clear divider'],
      },
    ],
  },
  {
    version: '2026.04.4',
    date: '2026-04-01',
    title: 'Activities UX Overhaul, Google & Twitch SSO',
    highlights: [
      'Activities page simplified — 4 clean filters replace 9 tabs',
      'Unified activity card with per-ship crew breakdown',
      'LFG feed widget on your dashboard with dedicated notification settings',
      'Google and Twitch SSO login and account linking',
      'Sent messages now show recipient names in the Inbox',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'LFG Dashboard widget — shows recent open LFG posts with participant counts and start times',
          'LFG notification category — toggle LFG alerts independently in notification settings',
          'LFG tab in org Discord Settings with channel config, Smart Ping, and cross-org visibility',
          'Google and Twitch SSO — sign in with branded buttons on the login page',
          'Connected Accounts section in Account Settings — link or unlink Google and Twitch',
        ],
      },
      {
        category: 'improved',
        items: [
          'Unified activity card — jobs, LFG, events, and operations share one consistent design with crew breakdown, pay, and role details',
          'Activities page — Type dropdown, Status dropdown, My Activities checkbox, and Calendar toggle replace the old tabs and chips',
          'Activity detail page uses collapsible sections instead of 6 tabs — Overview and Ships & Crew expand by default',
          'Pluralization fixes — "0 Open Positions" instead of "0 Open Position"',
          'New notification categories default to enabled',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Inbox sent messages now show the target organization or alliance name instead of "Unknown"',
          'Team member management no longer causes 401 errors',
          'Contact request replies return the correct sender info',
        ],
      },
    ],
  },
  {
    version: '2026.04.3',
    date: '2026-04-01',
    title: 'Org Fleet — Member Ships Now Display Correctly',
    highlights: [
      "Organization fleet now correctly shows only your members' shared ships",
      'Fleet statistics are scoped to your organization',
      'Ship owner names appear in the Member Ships tab',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Organization fleet "Member Ships" tab now shows only ships from your org members — no more unrelated ships',
          "Fleet summary statistics now reflect your organization's actual fleet",
          'Alliance shared ships view correctly filters to your org members',
        ],
      },
      {
        category: 'improved',
        items: ["Member ships now display the owner's username alongside the ship details"],
      },
    ],
  },
  {
    version: '2026.04.2',
    date: '2026-04-01',
    title: 'Directory Fixes',
    highlights: [
      'Organization cards show descriptions again',
      'Member counts reflect actual membership',
      'Job listings appear correctly in the Opportunities tab',
    ],
    changes: [
      {
        category: 'fixed',
        items: [
          'Organization cards now show descriptions in all directory views',
          'Member count on org cards reflects live data instead of stale values',
          'Job listings appear correctly in the Opportunities tab on both public and protected directories',
        ],
      },
    ],
  },
  {
    version: '2026.04.1',
    date: '2026-04-01',
    title: 'Longer Sessions & Smoother Login',
    highlights: [
      'Sessions now last up to 1 hour without interruptions',
      'Your session refreshes automatically while you are active',
      'Idle timeout extended to 30 minutes',
      'Teams page no longer logs you out',
    ],
    changes: [
      {
        category: 'fixed',
        items: ['Clicking on Teams no longer causes a surprise logout'],
      },
      {
        category: 'improved',
        items: [
          'Sessions last up to 1 hour instead of 15 minutes — no more frequent re-logins',
          'Your session refreshes automatically in the background while you are active',
          'Idle timeout extended from 15 to 30 minutes',
          '"Keep Session" on the timeout warning fully extends your session instead of just dismissing the dialog',
          'Active users can stay logged in for hours as long as they keep using the app',
        ],
      },
    ],
  },
  {
    version: '2026.03.9',
    date: '2026-03-31',
    title: 'Application Forms, Federation Features & Discord Bot Overhaul',
    highlights: [
      'Discord bot streamlined — 34 commands consolidated into 12 domain groups',
      'Organization context auto-detected from your Discord server — no more orgid parameter',
      'Custom application forms — define up to 20 questions for org join requests',
      'Federation ambassadors — appoint representatives with configurable permissions',
      'Federation Wiki — shared knowledge base with visibility tiers',
      'Federation Announcements — broadcast to member organizations',
      'Federation Polls — weighted or equal voting with real-time results',
      'Cross-Org Teams — task forces and joint operations across member orgs',
      'Federation Intel Vault — shared intelligence with classification levels',
      'Federation Central Discord Server — link a Discord guild as a shared meeting point',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Application Form Builder — define custom questions (Short Answer, Paragraph, Select, Checkbox, Rules) in Org Settings',
          'Adaptive Apply to Join dialog — automatically shows Simple, Custom Form, or Discord mode based on org config',
          'Form Responses in Review — admins see structured answers with question labels in expandable rows',
          'Application source tracking — each application shows Web, Discord, or API badge',
          'Federation Ambassadors — appoint users to represent member orgs with configurable permissions',
          'Ambassadors tab in Alliance management — appoint, edit, and remove ambassadors',
          'Federation Wiki — create, edit, delete knowledge base pages with visibility levels (public, members, council)',
          'Wiki pages support hierarchical nesting (max 3 levels) with tag organization',
          'Federation Announcements — broadcast messages to all members or council-only with pin/unpin',
          'Federation Polls — create polls with equal or weighted voting, view results, close/delete',
          'Cross-Org Teams — create task forces, diplomatic missions, and joint operations with member management',
          'Federation Intel Vault — submit, approve, archive, delete intel with open/restricted/secret classification',
          'Discord /federation command — 6 subcommands for info, members, announcements, intel, polls, and teams',
          'Cross-Org HR — personnel directory with search, ambassador badges, and org-level summary stats',
          'Federation Applications — organizations can apply to join federations with simple or custom form',
          'Federation Central Discord Server — link a Discord guild as shared meeting point with org-based role sync',
          'Auto-assign org and hierarchy roles when users join the central Discord server',
          'Conflict detection — users in multiple member orgs flagged for manual review',
          'Recruitment page moved to Community Hub',
          'Applicants tab on Recruitment page — review, approve, or reject join applications directly',
          'Alliance Management landing page — auto-redirects for single alliance, shows picker for multiple',
          'Discord bot restructured — 34 commands consolidated into 12 domain-grouped parents',
          'Auto-resolve organization from linked Discord server — no more orgid parameter needed',
          'Auto-resolve user profile — /info user defaults to your own profile',
          '/help command updated with subcommand groups within each parent',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord bot error handling improved — commands no longer time out unexpectedly',
          'Application mode visible to unauthenticated users — see Discord redirect without signing in first',
          'Required form questions are now enforced',
          'Application Review Panel shows Source column and expandable form response details',
          'Fleet composition loads faster',
          'Activity list loads faster with instant tab switching',
          'Error messages are now specific instead of generic across activities, login, 2FA, dashboards, and more',
          'Fleet and role badges follow your light/dark theme preference',
          'Changelog page is now accessible without logging in at /changelog',
          "Landing page footer links to What's New, Directory, and Stats",
          'Announcements tab connected to real API — full create/read/update/delete',
          'Intel tab connected to real API — full functionality with approval workflow',
          'Federation Discord tab shows connection status, available commands, and feature grid',
          'Sidebar navigation highlighting now works correctly when viewing sub-pages',
          'Recruitment Management page design refreshed',
          'Org Settings Public Profile fields stacked vertically — Focus Areas and Timezone no longer overlap',
          'Discord Invite Form merged into Application Settings — removes duplicate card',
          'Activities and Announcements default to Open/Sent status on creation — no more incorrect Draft tag',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Personal Hangar Ship Deletion — deleted ships no longer appear as ghost records',
          'Clear All Ships — entire hangar removed in a single fast operation',
          'Trade Route Bulk Updates — updating many trade routes no longer causes slowdowns',
          'Org Settings Integration tab no longer crashes',
          'Jobs & Opportunities no longer returns a 401 error',
          'Ship catalogue loads correctly',
          'Encryption key generation works in all browsers',
          '2FA error messages now show the actual problem instead of a generic message',
        ],
      },
    ],
  },
  {
    version: '2026.03.8',
    date: '2026-03-31',
    title: 'Permissions & Roles, 2FA & Passkeys',
    highlights: [
      'Members & Roles page now includes Permissions and Roles management tabs',
      'Passkey (WebAuthn) registration works on fringecore.space',
      '2FA authenticator app setup uses "Fringe Core" as the issuer name',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Permissions tab — manage custom per-user permissions from Members & Roles',
          'Roles tab — create, edit, and delete role templates',
          'Passkey support — register hardware security keys and biometric authentication',
          '2FA setup — configure TOTP authenticator apps for your account',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Passkey registration now works in production',
          '2FA authenticator shows "Fringe Core" as the app name',
          'Clear All Ships no longer triggers rate limit errors',
          'Bulk ship operations stay within rate limits',
        ],
      },
      {
        category: 'improved',
        items: [
          'Members & Roles page consolidates Members, Permissions, and Roles in one place',
          'Bulk operations (like clearing all ships) are now more reliable',
        ],
      },
    ],
  },
  {
    version: '2026.03.7',
    date: '2026-03-31',
    title: 'Intel Vault Overhaul, Ship Names & Bug Fixes',
    highlights: [
      'Intel Officers moved inside Intel Vault as a tab',
      'Ship names display with proper capitalization',
      'Clear All Ships now works and updates instantly',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Intel Vault now has 3 tabs: Intel Entries, Intel Officers, and Shared Accounts',
          'Add Shared Account dialog — create shared accounts with name, type, and username',
          'Ship name formatting — proper title case, uppercase model tags (F7A, F8C, ATLS), and roman numerals (Mk II)',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Clear All Ships button now actually removes ships from the list instantly',
          'Intel entries and officers pages load correctly',
          'Discord avatar reset fetches your actual Discord profile picture',
          'Organization profile save and load works for founders',
          'Member Audit profile drawer loads without errors',
          'Webhook management no longer fails',
          'Bounty and mining operation dashboards load correctly',
        ],
      },
      {
        category: 'improved',
        items: [
          'Intel Officers moved into the Intel Vault tabs — cleaner sidebar',
          'Ship names consistently formatted across hangar, edit, delete, and loan dialogs',
          'Faster and more reliable connections',
        ],
      },
    ],
  },
  {
    version: '2026.03.6',
    date: '2026-03-30',
    title: 'Org Logo & Banner, Avatar Reset & Profile Images',
    highlights: [
      'Set custom logo and banner URLs for your organization profile',
      'RSI Import now also pulls your org logo automatically',
      'Reset your avatar to your Discord or RSI profile picture with one click',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Organization logo and banner URL fields in Org Settings',
          'RSI Import now pulls your organization logo in addition to banner, description, and focus',
          'Reset Avatar buttons — reset to your Discord or RSI avatar from the Edit Profile page',
        ],
      },
      {
        category: 'improved',
        items: [
          'Organization profile page shows your RSI logo when available',
          'Logo and banner fields accept any valid HTTPS image URL',
          'Avatar reset fetches the latest picture from Discord or RSI',
        ],
      },
    ],
  },
  {
    version: '2026.03.5',
    date: '2026-03-30',
    title: 'Org Profile Features, RSI Import & Stability',
    highlights: [
      'Select up to 3 focus areas for your organization',
      'Import org logo, banner, and profile data from RSI with one click',
      'Choose which SCStats sections appear on your public profile',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Multiple focus areas — select up to 3 (e.g., Combat + Mining + Exploration)',
          'Import from RSI — pull your org banner, description, focus areas, and social links from your RSI page',
          'SCStats visibility control — choose which analytics sections show on your public profile',
          'Clear All Ships — bulk delete your entire hangar with progress tracking',
          'RSI org search in Relationships — look up any Star Citizen org by SID',
          'User avatars shown in Members list and Member Audit pages',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Intel Vault and Intel Officers accessible for organization founders',
          'Member Audit profile drawer loads correctly',
          'Ship deletion from Personal Hangar shows clear error messages',
          'Bounty tracking and Mining Operations dashboard load correctly',
          'Activity Templates page loads correctly',
        ],
      },
      {
        category: 'improved',
        items: [
          'Fewer "Cannot read data" errors across the app',
          'Faster and more reliable connections',
        ],
      },
    ],
  },
  {
    version: '2026.03.4',
    date: '2026-03-30',
    title: 'Founder Role, Discord Setup & Members Overhaul',
    highlights: [
      'Organization founders now have full owner-level access everywhere',
      'Connect your Discord server with a guided setup flow',
      'Members list shows real usernames and proper role badges',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Discord server setup — connect your Discord from the Integration page with a guided 2-step flow',
          '/guild slash command — link, check status, or unlink your Discord server from chat',
          'Activity Templates — create reusable templates for operations, mining runs, and events',
          'Organization Relations — track alliances, rivals, and agreements with other orgs',
          'Add Relationship button visible for founders, admins, and officers',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Founders now have full access to Intel Vault, Encryption, Discord, Fleet tools, Roles, and all admin features',
          'Members & Roles shows actual usernames and avatars instead of raw IDs',
          'Member Audit displays proper names and "Founder" role badge',
          'Webhook management loads without errors',
          'Avatar uploads work without cloud storage configuration',
          'Ship delete confirmation shows errors instead of failing silently',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord Integration page uses your real organization context',
          'Personal Hangar delete shows loading spinner and error feedback',
          'Members page loads faster',
        ],
      },
    ],
  },
  {
    version: '2026.03.3',
    date: '2026-03-30',
    title: 'Ship Loans, Fleet Browsing & Bug Fixes',
    highlights: [
      'Loan your ships to your org or alliance with date ranges',
      'Browse your entire fleet with proper pagination',
      'Sidebar highlights the correct section when browsing',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Loan ships to your Organization or Alliance from your Personal Hangar',
          'View active loans, available ships, and loan history in the Org Fleet "Loans" tab',
          'Loan records linked to activities — see which mission a ship was loaned for',
          'Return loaned ships with one click from the fleet table',
          'Set an Erkul loadout URL and share ships with specific users',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Profile avatar uploads work reliably for larger images',
          'Community Hub sidebar stays active when browsing directories',
          'Ship count shows your total fleet, not just the current page',
          'Editing a ship no longer creates a duplicate entry',
          'Alliance directory and org loan history pages load correctly',
        ],
      },
      {
        category: 'improved',
        items: [
          'Personal Hangar and Org Fleet load faster with server-side pagination',
          'Temporary server errors are automatically retried',
          'Error messages explain what went wrong instead of showing generic failures',
          'Alliance Management has its own navigation entry',
        ],
      },
    ],
  },
  {
    version: '2026.03.2',
    date: '2026-03-29',
    title: 'Discord Bot, RSI Tracking & Integrations',
    highlights: [
      '35 Discord slash commands for fleet, events, and org management',
      'Track RSI profile changes for citizens and organizations',
      'Ship Performance Viewer integration',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Discord bot with 35 slash commands — manage fleets, events, bounties, and more from Discord',
          'RSI change history — see field-level diffs when citizen or org profiles change',
          'Ship Performance Viewer (spviewer.eu) link in ship details',
          'User avatar in the navigation menu',
          'Ko-fi support and GitHub feedback links in About',
        ],
      },
      {
        category: 'fixed',
        items: [
          'Bot starts reliably without blocking the main application',
          'RSI crawler uses updated data for richer org info',
          'Ship data matches correctly when adding ships to your hangar',
        ],
      },
      {
        category: 'improved',
        items: [
          'Discord bot runs seamlessly alongside the web app',
          'Ship Performance Viewer credited in About modal',
        ],
      },
    ],
  },
  {
    version: '2026.03.1',
    date: '2026-03-22',
    title: 'Calendar, Bot Commands & Quality of Life',
    highlights: [
      'Create events with duration and recurrence',
      'Browse all bot commands with search and filtering',
      'Notification preferences now save correctly',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Set duration and recurrence when creating events',
          'Bot Commands page — browse all 35 commands with search and categories',
          'RSI organization discovery — automatically find and track SC orgs',
          "This Changelog page — see what's new in every update",
        ],
      },
      {
        category: 'fixed',
        items: [
          'Event creation works reliably (was failing silently)',
          'Bot commands page shows data correctly',
          'Consent banner dismisses properly after accepting',
          'RSI verification code generation handles errors gracefully',
          'Notification preferences save and load correctly',
        ],
      },
      {
        category: 'improved',
        items: [
          'Calendar navigation renamed for clarity',
          'Help Center icons updated for consistency',
        ],
      },
    ],
  },
  {
    version: '2025.01.1',
    date: '2025-01-01',
    title: 'Platform Launch',
    highlights: [
      'Fleet management with real-time collaboration',
      'Organization creation and multi-tenant support',
      'Discord, Azure AD, and RSI login options',
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Personal Hangar — manage your Star Citizen ships and track their status',
          'Organization management — create orgs, invite members, assign roles',
          'Fleet coordination — organize ships into fleets for operations',
          'Activity & event planning — schedule operations with attendance tracking',
          'Login with Discord, Microsoft, or RSI account',
          'GDPR tools — export your data, request deletion, manage consent',
          'Real-time updates — see changes instantly when teammates update fleets',
          'Dashboard with analytics, quick actions, and org overview',
          'Help Center with searchable FAQ and getting started guides',
          'Privacy controls — manage what data is visible to others',
        ],
      },
    ],
  },
];
