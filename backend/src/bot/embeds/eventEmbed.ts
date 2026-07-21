import type {
  ActivityCardData,
  PassengerSlot,
  TransportType,
} from '@sc-fleet-manager/shared-types';
import {
  decodeHtmlEntities,
  getActivityStatusConfig,
  getActivityTypeConfig,
} from '@sc-fleet-manager/shared-types';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import { getFrontendUrl } from '../../config/urls';
import { getShipRoleEmoji, type ShipRequirement } from '../constants/shipTaxonomy';
import {
  createProgressBar,
  formatDiscordTimestamp,
  getActivityAccentColor,
  SCFleetEmbed,
  TimestampFormat,
} from '../utils/embedBuilder';
import { getRoleEmoji } from '../utils/emojiMaps';

// Import shared types for consistency

/**
 * Legend for the icon-only RSVP buttons, surfaced in the event embed footer so
 * the meaning of each icon stays discoverable without per-button labels.
 */
export const RSVP_LEGEND = '✅ Join · ❓ Tentative · ❌ Decline · 📤 Withdraw';

/**
 * Activity data shape for embed rendering.
 * Extends the normalized ActivityCardData from shared-types for card-level
 * parity with ActivityCard and PublicJobCard, then adds Discord-specific
 * rich fields (crew rosters, route planning, participant lists).
 */

/** Crew member on a ship (mirrors backend CrewMember). */
export interface EmbedCrewMember {
  userId: string;
  userName: string;
  position: string; // e.g. 'Captain', 'Gunner', 'Engineer'
  /** Discord snowflake for this user — used to build a real `<@id>` mention. */
  discordUserId?: string;
}

// Note: PassengerSlot is now imported from @sc-fleet-manager/shared-types
// Re-export for convenience in bot code
export type EmbedPassengerSlot = PassengerSlot;

/** Ship assignment (mirrors backend ShipAssignment – subset for embed rendering). */
export interface EmbedShipAssignment {
  id: string;
  shipType: string;
  shipName?: string;
  ownerId: string;
  ownerName: string;
  fleetId?: string;
  fleetName?: string;
  captainId?: string;
  captainName?: string;
  role?: string; // combat, mining, cargo, medical, support, scout, other
  crewCapacity: number;
  crewAssigned: number;
  crewMembers: EmbedCrewMember[];
  status?: string;
  /** Loaner ship given when the main ship is not yet flyable. */
  loanerShip?: string;
  /** Whether this ship is a loaner (contributed by someone not personally crewing it). */
  isLoaner?: boolean;
  /** Display name of person who contributed/provided this ship. */
  contributedBy?: string;
  /** Cargo capacity in SCU. */
  cargo?: number;
  /** Vehicle cargo capacity (ground vehicles). */
  vehicleCargo?: number;
  /** Hangar size — can carry other ships. */
  hangarSize?: string;
  /** ID of parent ship if this is transported inside another ship. */
  parentShipId?: string;
  /** Whether this entry is nested inside a parent ship. */
  isTransported?: boolean;
  /**
   * Transport method:
   * - 'hangar' – ship stored in a hangar
   * - 'cargo' – vehicle/ship in a cargo bay
   * - 'tractor_beam' – attached via tractor beam
   * - 'docking_collar' – attached via docking collar
   */
  transportType?: TransportType;
  /** Passengers (NOT counted toward crew totals). */
  passengers?: EmbedPassengerSlot[];
}

/**
 * Full event embed data.
 * Extends ActivityCardData (card-level parity) with Discord-specific rich fields.
 *
 * Field mapping from old EventEmbedData:
 *   activityType  → type        (from ActivityCardData, lowercase)
 *   scheduledStartDate → startDate (from ActivityCardData)
 *   pay           → payDisplay  (from ActivityCardData)
 *   focusRole     → focusRole   (embed-only, used for accent color)
 *   creatorId     → dropped (only creatorName is rendered)
 */
export interface EventEmbedData extends ActivityCardData {
  /** Last update time for the activity, used for the embed's footer timestamp. */
  updatedAt?: string | Date;
  /** Primary role focus for accent colour derivation (e.g. 'pilot', 'miner'). */
  focusRole?: string;
  /** Creator user ID — used for cancel button permission check. */
  creatorId?: string;
  /** Banner image URL for the embed image (large). */
  bannerImageUrl?: string;
  /** Discord voice channel ID linked to this event. */
  voiceChannelId?: string;
  /** Legacy: plain-text required ship names (e.g. ["Gladius", "Carrack"]). */
  shipRequirements?: string[];
  /** Structured ship requests by role/type with fill tracking. */
  shipRequestsByRole?: ShipRequirement[];
  /** Ships committed to this activity with crew rosters. */
  ships?: EmbedShipAssignment[];
  participants?: Array<{
    userId: string;
    userName?: string;
    /** Discord snowflake for this user — used to build a real `<@id>` mention. */
    discordUserId?: string;
    status: string; // 'accepted' | 'standby' | 'declined' | 'waitlisted'
    role?: string;
    shipType?: string;
    shipName?: string;
    crewPosition?: string;
    crewShipId?: string;
  }>;
  roleRequirements?: Array<{
    role: string;
    count?: number;
    min?: number;
    required?: boolean;
  }>;
  metadata?: Record<string, unknown>;
  /* ─── Route Planning Fields ─────────────────────────────────────── */
  /** Total cargo capacity of the fleet (SCU) - from ship catalogue */
  totalCargoCapacity?: number;
  /** Total quantum fuel capacity of the fleet (SCU) - from ship catalogue */
  totalQuantumFuel?: number;
  /** Total quantum fuel required for the route (SCU) - sum of waypoint requirements */
  totalQuantumFuelRequired?: number;
  /** Maximum jump range limited by the bottleneck ship (km) */
  maxJumpRange?: number;
  /** Whether the fleet includes a refuel-capable ship (Starfarer, Vulcan) */
  hasRefuelShip?: boolean;
  /** Whether the fleet includes a repair-capable ship */
  hasRepairShip?: boolean;
  /** Whether the fleet includes a rearm-capable ship */
  hasRearmShip?: boolean;
  /** Whether the fleet includes a medical ship */
  hasMedicalShip?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Truncate text to a max length with an ellipsis. */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Titlecase a snake/upper string for display. */
function prettify(text: string): string {
  return text
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Render a Discord-friendly user mention.
 *
 * Discord only renders `<@id>` as a real mention when `id` is a numeric
 * snowflake. The platform's internal `userId` is a UUID, so falling back
 * to `<@uuid>` shows up as raw text in the embed (e.g.
 * `<@257e31b8-6f1a-4b4a-905c-d4f11a380111>`). When the user has not
 * linked a Discord account (or we couldn't resolve it), render their
 * `userName` in bold instead so the line is still readable.
 */
function mentionUser(p: {
  userId: string;
  discordUserId?: string | null;
  userName?: string | null;
}): string {
  if (p.discordUserId) {
    return `<@${p.discordUserId}>`;
  }
  if (p.userName) {
    return `**${p.userName}**`;
  }
  return `User ${p.userId.slice(0, 8)}`;
}

/* ------------------------------------------------------------------ */
/*  Embed section builders (extracted from buildEventEmbed)            */
/* ------------------------------------------------------------------ */

type EmbedField = { name: string; value: string; inline: boolean };

/** Discord embed field limits — clamp dynamic field payloads before Discord rejects the embed. */
const DISCORD_FIELD_NAME_LIMIT = 256;
const DISCORD_FIELD_VALUE_LIMIT = 1024;

function clampFieldText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function withFieldBudget(field: EmbedField): EmbedField {
  return {
    ...field,
    name: clampFieldText(field.name, DISCORD_FIELD_NAME_LIMIT),
    value: clampFieldText(field.value, DISCORD_FIELD_VALUE_LIMIT),
  };
}

/** Participant bucket grouped from raw participants. */
interface ParticipantBuckets {
  accepted: EventEmbedData['participants'] & unknown[];
  tentative: EventEmbedData['participants'] & unknown[];
  declined: EventEmbedData['participants'] & unknown[];
  waitlisted: EventEmbedData['participants'] & unknown[];
}

function bucketParticipants(participants?: EventEmbedData['participants']): ParticipantBuckets {
  const list = participants ?? [];
  return {
    accepted: list.filter(p => p.status === 'accepted'),
    tentative: list.filter(p => p.status === 'standby'),
    declined: list.filter(p => p.status === 'declined'),
    waitlisted: list.filter(p => p.status === 'waitlisted'),
  };
}

/** Open Positions / capacity field. */
function buildPositionField(maxSlots: number, buckets: ParticipantBuckets): EmbedField {
  if (maxSlots > 0) {
    const progressBar = createProgressBar(buckets.accepted.length, maxSlots, {
      width: 12,
      showPercentage: false,
    });
    return {
      name: '👥 Open Positions',
      value: `${progressBar}  **${buckets.accepted.length}** / **${maxSlots}** filled`,
      inline: false,
    };
  }

  const parts = [
    `✅ **${buckets.accepted.length}** accepted`,
    `❓ **${buckets.tentative.length}** tentative`,
    `❌ **${buckets.declined.length}** declined`,
    ...(buckets.waitlisted.length > 0 ? [`📝 **${buckets.waitlisted.length}** waitlisted`] : []),
  ];
  return {
    name: '👥 Participants',
    value: parts.join('  ·  '),
    inline: false,
  };
}

/** Ship request strictness badge lookup. */
const STRICTNESS_BADGE: Record<string, string> = {
  required: ' 🔴',
  preferred: ' 🟡',
};

/** Format a single ship request line. */
function formatShipRequestLine(req: ShipRequirement): string {
  const emoji = getShipRoleEmoji(req.role);
  const label = req.type
    ? `**${req.type}**`
    : req.role
      ? `**${req.role}** *(any type)*`
      : '**Any Ship**';
  const bar = createProgressBar(req.filled, req.count, { width: 8, showPercentage: false });
  const badge = STRICTNESS_BADGE[req.strictness ?? ''] ?? ' 🟢';
  const loaner = req.loanerAccepted ? ' 🏷️' : '';
  return `${emoji} ${label}${badge}${loaner}  ${bar}  ${req.filled}/${req.count}`;
}

/** Format a single committed ship with its crew (no nesting — top-level only). */
function buildCrewList(ship: EmbedShipAssignment, indent = ''): string {
  if (ship.crewMembers.length === 0) {
    return `${indent}  └ *No crew assigned*`;
  }

  const crewColumns = 2;
  const crewRows = 5;
  const maxVisibleCrew = crewColumns * crewRows;

  const visibleCrewMembers = ship.crewMembers.slice(0, maxVisibleCrew);
  const leftColumn = visibleCrewMembers.slice(0, crewRows);
  const rightColumn = visibleCrewMembers.slice(crewRows, maxVisibleCrew);

  const crewRowsText: string[] = [];
  for (let row = 0; row < crewRows; row++) {
    const left = leftColumn[row];
    const right = rightColumn[row];

    if (!left && !right) {
      continue;
    }

    const leftText = left ? `${left.position}: ${mentionUser(left)}` : '';
    const rightText = right ? `${right.position}: ${mentionUser(right)}` : '';

    if (left && right) {
      crewRowsText.push(`${indent}  └ ${leftText}   │   ${rightText}`);
    } else {
      crewRowsText.push(`${indent}  └ ${leftText || rightText}`);
    }
  }

  const remainingCrew = Math.max(0, ship.crewMembers.length - visibleCrewMembers.length);
  if (remainingCrew <= 0) {
    return crewRowsText.join('\n');
  }

  const remainingCrewLabel = remainingCrew === 1 ? 'crew member' : 'crew members';
  return `${crewRowsText.join('\n')}\n${indent}  └ *…and ${remainingCrew} more ${remainingCrewLabel}*`;
}

/** Format a single committed ship with its crew (no nesting — top-level only). */
function formatShipLine(ship: EmbedShipAssignment, indent = ''): string {
  const crewBar = createProgressBar(ship.crewAssigned, ship.crewCapacity, {
    width: 8,
    showPercentage: false,
  });
  const roleBadge = ship.role ? ` \`${prettify(ship.role)}\`` : '';
  const nameLabel = ship.shipName ? `**${ship.shipName}**` : `**${ship.shipType}**`;
  const typeLabel = ship.shipName ? ` (${ship.shipType})` : '';

  const badges = buildShipBadges(ship);
  const badgeLine = badges.length > 0 ? `\n${indent}  ${badges.join(' · ')}` : '';
  const crewList = buildCrewList(ship, indent);

  return `${indent}🚀 ${nameLabel}${typeLabel}${roleBadge}\n${indent}${crewBar}  ${ship.crewAssigned}/${ship.crewCapacity} crew${badgeLine}\n${crewList}`;
}

/** Build a tree of ships: parent ships contain children (vehicles/snubs in hangars/cargo). */
function buildShipTree(ships: EmbedShipAssignment[]): {
  parentShips: EmbedShipAssignment[];
  childMap: Map<string, EmbedShipAssignment[]>;
  orphanChildren: EmbedShipAssignment[];
} {
  const childMap = new Map<string, EmbedShipAssignment[]>();
  const parentShips: EmbedShipAssignment[] = [];
  const orphanChildren: EmbedShipAssignment[] = [];

  for (const ship of ships) {
    if (ship.isTransported && ship.parentShipId) {
      const children = childMap.get(ship.parentShipId) ?? [];
      children.push(ship);
      childMap.set(ship.parentShipId, children);
    } else {
      parentShips.push(ship);
    }
  }

  // Any children whose parent isn't in the list become orphans shown at top level
  for (const [parentId, children] of childMap) {
    if (!parentShips.some(p => p.id === parentId)) {
      orphanChildren.push(...children);
      childMap.delete(parentId);
    }
  }

  return { parentShips, childMap, orphanChildren };
}

/** Format a parent ship with nested children (transported vehicles/snubs). */
function formatShipWithChildren(
  parent: EmbedShipAssignment,
  children: EmbedShipAssignment[]
): string {
  const parentLine = formatShipLine(parent);
  if (children.length === 0) {
    return parentLine;
  }

  const childLines = children.slice(0, 3).map(child => {
    const transportIcons: Record<string, string> = {
      hangar: '🛬',
      cargo: '📦',
      tractor_beam: '🧲',
      docking_collar: '🔗',
    };
    const transportIcon = transportIcons[child.transportType ?? ''] ?? '🔗';
    const label = child.shipName
      ? `**${child.shipName}** (${child.shipType})`
      : `**${child.shipType}**`;
    const crewInfo =
      child.crewCapacity > 1 ? ` — ${child.crewAssigned}/${child.crewCapacity} crew` : '';
    return `  ${transportIcon} ↳ ${label}${crewInfo}`;
  });
  const childOverflow = children.length > 3 ? `\n  *↳ +${children.length - 3} more*` : '';

  return `${parentLine}\n${childLines.join('\n')}${childOverflow}`;
}

function groupShipsByFleet(ships: EmbedShipAssignment[]): Array<{
  title?: string;
  ships: EmbedShipAssignment[];
}> {
  const grouped = new Map<string, { title?: string; ships: EmbedShipAssignment[] }>();
  const ungrouped: EmbedShipAssignment[] = [];

  for (const ship of ships) {
    if (!ship.fleetName) {
      ungrouped.push(ship);
      continue;
    }

    const key = ship.fleetId ?? ship.fleetName;
    const existing = grouped.get(key);
    if (existing) {
      existing.ships.push(ship);
      continue;
    }

    grouped.set(key, { title: ship.fleetName, ships: [ship] });
  }

  const groups = [...grouped.values()];
  if (ungrouped.length > 0) {
    groups.push({ title: groups.length > 0 ? 'Independent Ships' : undefined, ships: ungrouped });
  }

  return groups;
}

function formatFleetShipGroup(
  group: { title?: string; ships: EmbedShipAssignment[] },
  childMap: Map<string, EmbedShipAssignment[]>
): string {
  const shipLines = group.ships.map(ship => {
    const children = childMap.get(ship.id) ?? [];
    return formatShipWithChildren(ship, children);
  });

  if (!group.title) {
    return shipLines.join('\n\n');
  }

  return `**${group.title}**\n${shipLines.join('\n\n')}`;
}

/** Detect fleet capabilities from ship types/roles. */
function detectFleetCapabilities(ships: EmbedShipAssignment[]): string[] {
  const capabilities: string[] = [];
  const allTypes = ships.map(s => (s.role ?? '').toLowerCase());
  const allShipTypes = ships.map(s => s.shipType.toLowerCase());

  // Check for refuel capability
  if (
    allTypes.some(t => t.includes('refuel')) ||
    allShipTypes.some(t => t.includes('starfarer') || t.includes('vulcan'))
  ) {
    capabilities.push('⛽ Refuel');
  }

  // Check for repair capability
  if (
    allTypes.some(t => t.includes('repair')) ||
    allShipTypes.some(t => t.includes('vulcan') || t.includes('crucible'))
  ) {
    capabilities.push('🔧 Repair');
  }

  // Check for rearm capability
  if (allTypes.some(t => t.includes('rearm')) || allShipTypes.some(t => t.includes('vulcan'))) {
    capabilities.push('🔄 Rearm');
  }

  // Check for medical capability
  if (
    allTypes.some(t => t === 'medical' || t.includes('medical')) ||
    allShipTypes.some(
      t => t.includes('apollo') || t.includes('endeavor') || t.includes('cutlass red')
    )
  ) {
    capabilities.push('🏥 Medical');
  }

  // Check for carrier capability
  if (
    ships.some(s => s.hangarSize) ||
    allShipTypes.some(t => t.includes('carrier') || t.includes('idris') || t.includes('kraken'))
  ) {
    capabilities.push('🛬 Carrier');
  }

  // Check for scanning capability
  if (
    allTypes.some(t => t.includes('scanning')) ||
    allShipTypes.some(t => t.includes('terrapin') || t.includes('herald'))
  ) {
    capabilities.push('📡 Scanning');
  }

  return capabilities;
}

/** Collect cargo/loaner/hangar/transport badges for a ship. */
function buildShipBadges(ship: EmbedShipAssignment): string[] {
  const badges: string[] = [];

  // Loaner information
  if (ship.isLoaner && ship.contributedBy) {
    badges.push(`🏷️ Loaner by ${ship.contributedBy}`);
  } else if (ship.loanerShip) {
    badges.push(`🏷️ Loaner: ${ship.loanerShip}`);
  }

  // Transport status
  if (ship.isTransported && ship.transportType) {
    const transportIcon =
      {
        hangar: '🛬',
        cargo: '📦',
        tractor_beam: '🧲',
        docking_collar: '🔗',
      }[ship.transportType] || '🚀';
    const transportLabel = prettify(ship.transportType);
    badges.push(`${transportIcon} Transported: ${transportLabel}`);
  }

  // Hangar capacity
  if (ship.hangarSize) {
    badges.push(`🛬 Hangar: ${ship.hangarSize}`);
  }

  // Cargo capacity
  if (ship.vehicleCargo && ship.vehicleCargo > 0) {
    badges.push(`🚗 Vehicle: ${ship.vehicleCargo} SCU`);
  } else if (ship.cargo && ship.cargo > 0) {
    badges.push(`📦 Cargo: ${ship.cargo} SCU`);
  }

  // Passenger capacity
  if (ship.passengers && ship.passengers.length > 0) {
    const totalPassengers = ship.passengers.reduce((sum, p) => sum + p.filled, 0);
    const totalCapacity = ship.passengers.reduce((sum, p) => sum + p.capacity, 0);
    badges.push(`👥 Passengers: ${totalPassengers}/${totalCapacity}`);
  }

  return badges;
}

/** Overflow helper: "…and N more" text when list is capped. */
function overflow(total: number, shown: number): string {
  return total > shown ? `\n*…and ${total - shown} more*` : '';
}

/** Build accepted participant lines (excludes crew members — they're shown under ships). */
function formatAcceptedLines(
  accepted: ParticipantBuckets['accepted'],
  crewUserIds: Set<string>
): string[] {
  return accepted
    .filter(p => !crewUserIds.has(p.userId))
    .slice(0, 15)
    .map(p => {
      const roleEmoji = p.role ? getRoleEmoji(p.role) : '👤';
      const shipTag = p.shipName ? ` 🚀\`${truncate(p.shipName, 16)}\`` : '';
      return `${roleEmoji} ${mentionUser(p)}${shipTag}`;
    });
}

/* ------------------------------------------------------------------ */
/*  Visibility label helper                                            */
/* ------------------------------------------------------------------ */

const VISIBILITY_LABELS: Record<string, string> = {
  organization: '🏢 Org Only',
  cross_org: '🤝 Cross-Org',
  alliance: '🔗 Alliance',
  private: '🔒 Private',
  listed: '📋 Listed',
};

function getVisibilityLabel(visibility?: string): string | null {
  if (!visibility || visibility === 'public') {
    return null;
  }
  return VISIBILITY_LABELS[visibility.toLowerCase()] ?? `🔒 ${prettify(visibility)}`;
}

function buildWebEventUrl(eventId: string, visibility?: string): string {
  const baseUrl = getFrontendUrl().replace(/\/+$/, '');
  const normalizedVisibility = visibility?.toLowerCase();
  const eventPath =
    normalizedVisibility === 'public' || normalizedVisibility === 'listed'
      ? `/opportunities/activities/${encodeURIComponent(eventId)}`
      : `/activities/${encodeURIComponent(eventId)}`;
  return `${baseUrl}${eventPath}`;
}

/* ------------------------------------------------------------------ */
/*  Main embed builder                                                 */
/* ------------------------------------------------------------------ */

/**
 * Builds a rich event embed styled after the PublicJobCard component.
 *
 * Uses shared ACTIVITY_TYPE_CONFIG / ACTIVITY_STATUS_CONFIG from
 * @sc-fleet-manager/shared-types so type emojis, status badges, and
 * accent colors are in sync with the web cards.
 *
 * Visual mapping (PublicJobCard → Discord embed):
 *   accent color bar  → embed side color  (role/type-based)
 *   header + owner    → author field
 *   title             → embed title
 *   type/status       → inline badge fields
 *   description       → embed description  (2 lines max)
 *   stats (pay / exp) → inline fields
 *   open positions    → progress bar field
 *   role requirements → individual progress bars
 *   ship requirements → field with ship names
 *   tags              → field with tag pills
 *   participants      → accepted/tentative grids
 *   posted date       → footer with relative time
 */
export function buildEventEmbed(event: EventEmbedData): EmbedBuilder {
  const buckets = bucketParticipants(event.participants);
  const startDate = event.startDate ? new Date(event.startDate) : undefined;

  // ── Shared display configs ──
  const typeCfg = getActivityTypeConfig(event.type);
  const statusCfg = getActivityStatusConfig(event.status);

  // ── Accent colour: derive from focusRole → activityType → default ──
  const accentColor = getActivityAccentColor(event.focusRole || event.type);

  // ── Embed scaffold via SCFleetEmbed factory ──

  // Build compact info line: Type · Status · Location
  const infoParts = [
    `🏷️ ${typeCfg.label}`,
    statusCfg.discordBadge,
    `📍 ${decodeHtmlEntities(event.location) || 'TBD'}`,
  ];
  if (event.organizationName) {
    infoParts.push(`🏢 ${decodeHtmlEntities(event.organizationName)}`);
  }
  const visibilityLabel = getVisibilityLabel(event.visibility);
  if (visibilityLabel) {
    infoParts.push(visibilityLabel);
  }
  const infoLine = infoParts.join('  **·**  ');

  // Build compact description
  const descText = event.description
    ? truncate(decodeHtmlEntities(event.description), 200)
    : '*No description provided*';

  const builder = SCFleetEmbed.create()
    .setColor(accentColor)
    .setTitle(`${typeCfg.emoji}  ${decodeHtmlEntities(event.title)}`)
    .setDescription(`${descText}\n\n─ ─ ─ ─ ─ ─ ─ ─ ─\n${infoLine}`);

  if (event.creatorName) {
    builder.setAuthor({ name: decodeHtmlEntities(event.creatorName) });
  }

  /* ─── Banner Image ────────────────────────────────────────────── */
  if (event.bannerImageUrl) {
    builder.setImage(event.bannerImageUrl);
  }

  /* ─── When ─────────────────────────────────────────────────────── */
  builder.addFields(
    withFieldBudget({
      name: '🕒 When',
      value: startDate
        ? `${formatDiscordTimestamp(startDate, TimestampFormat.LONG_DATETIME)}  (${formatDiscordTimestamp(startDate, TimestampFormat.RELATIVE)})`
        : 'Not scheduled',
      inline: false,
    })
  );

  /* ─── Voice Channel ────────────────────────────────────────────── */
  if (event.voiceChannelId) {
    builder.addFields(
      withFieldBudget({
        name: '🔊 Voice Channel',
        value: `<#${event.voiceChannelId}>`,
        inline: false,
      })
    );
  }

  /* ─── Stats row: Pay · Experience ─────────────────────────────── */
  const statsFields: EmbedField[] = [];
  if (event.payDisplay) {
    statsFields.push({ name: '💰 Pay', value: event.payDisplay, inline: true });
  }
  if (event.experienceLevel) {
    statsFields.push({
      name: '📊 Experience',
      value: prettify(String(event.experienceLevel)),
      inline: true,
    });
  }
  const webEventUrl = buildWebEventUrl(event.id, event.visibility);
  if (statsFields.length > 0) {
    builder.addFields(...statsFields.map(withFieldBudget));
  }

  /* ─── Section separator: schedule → participants ──────────────── */
  builder.addFields(withFieldBudget({ name: '\u200B', value: '\u200B', inline: false }));

  /* ─── Open Positions / capacity ───────────────────────────────── */
  builder.addFields(withFieldBudget(buildPositionField(event.maxParticipants || 0, buckets)));

  /* ─── Role Requirements ───────────────────────────────────────── */
  if (event.roleRequirements && event.roleRequirements.length > 0) {
    const reqLines = event.roleRequirements.map(req => {
      const needed = req.min ?? req.count ?? 1;
      const filled = buckets.accepted.filter(p => p.role === req.role).length;
      const emoji = getRoleEmoji(req.role);
      const bar = createProgressBar(filled, needed, { width: 8, showPercentage: false });
      return `${emoji} **${prettify(req.role)}**  ${bar}  ${filled}/${needed}`;
    });
    builder.addFields(
      withFieldBudget({ name: '📋 Role Requirements', value: reqLines.join('\n'), inline: false })
    );
  }

  /* ─── Section separator: participants → ships ─────────────────── */
  const hasShipContent =
    (event.shipRequestsByRole && event.shipRequestsByRole.length > 0) ||
    (event.shipRequirements && event.shipRequirements.length > 0) ||
    (event.ships && event.ships.length > 0);
  if (hasShipContent) {
    builder.addFields(withFieldBudget({ name: '\u200B', value: '\u200B', inline: false }));
  }

  /* ─── Ship Requests by Role/Type ──────────────────────────────── */
  if (event.shipRequestsByRole && event.shipRequestsByRole.length > 0) {
    const reqLines = event.shipRequestsByRole.map(formatShipRequestLine);
    builder.addFields(
      withFieldBudget({
        name: '🚀 Ship Requests',
        value: `${reqLines.join('\n')}\n-# 🔴 Required  🟡 Preferred  🟢 Flexible  🏷️ Loaner OK`,
        inline: false,
      })
    );
  }

  /* ─── Legacy Ship Requirements ────────────────────────────────── */
  const hasStructuredShips = event.shipRequestsByRole && event.shipRequestsByRole.length > 0;
  if (event.shipRequirements && event.shipRequirements.length > 0 && !hasStructuredShips) {
    const ships = event.shipRequirements.slice(0, 6);
    builder.addFields(
      withFieldBudget({
        name: '🚀 Ships Required',
        value: ships.map(s => `\`${s}\``).join('  ') + overflow(event.shipRequirements.length, 6),
        inline: false,
      })
    );
  }

  /* ─── Ships & Crew (tree with nested transport/hangar children) ─ */
  if (event.ships && event.ships.length > 0) {
    const totalCrew = event.ships.reduce((sum, s) => sum + s.crewAssigned, 0);
    const totalCapacity = event.ships.reduce((sum, s) => sum + s.crewCapacity, 0);

    const { parentShips, childMap, orphanChildren } = buildShipTree(event.ships);
    const visibleParents = [...parentShips, ...orphanChildren];
    const groupedShips = groupShipsByFleet(visibleParents.slice(0, 6));
    const shipLines = groupedShips.map(group => formatFleetShipGroup(group, childMap));

    builder.addFields(
      withFieldBudget({
        name: `🛸 Ships (${event.ships.length}) — ${totalCrew}/${totalCapacity} crew`,
        value: shipLines.join('\n\n━━\n\n') + overflow(visibleParents.length, 6),
        inline: false,
      })
    );
  }

  /* ─── Fleet Capabilities (auto-detected badges) ──────────────── */
  if (event.ships && event.ships.length > 0) {
    const capabilities = detectFleetCapabilities(event.ships);

    // Also add explicit flags from EventEmbedData
    if (event.hasRefuelShip && !capabilities.includes('⛽ Refuel')) {
      capabilities.unshift('⛽ Refuel');
    }
    if (event.hasRepairShip && !capabilities.includes('🔧 Repair')) {
      capabilities.push('🔧 Repair');
    }
    if (event.hasRearmShip && !capabilities.includes('🔄 Rearm')) {
      capabilities.push('🔄 Rearm');
    }
    if (event.hasMedicalShip && !capabilities.includes('🏥 Medical')) {
      capabilities.push('🏥 Medical');
    }

    if (capabilities.length > 0) {
      builder.addFields(
        withFieldBudget({
          name: '🏷️ Fleet Capabilities',
          value: capabilities.join('  **·**  '),
          inline: false,
        })
      );
    }
  }

  /* ─── Route Planning & Fleet Logistics ────────────────────────── */
  const hasRouteData =
    event.totalCargoCapacity !== undefined ||
    event.totalQuantumFuel !== undefined ||
    event.maxJumpRange !== undefined ||
    event.hasRefuelShip !== undefined;

  if (hasRouteData) {
    const routeLines: string[] = [];

    if (event.totalCargoCapacity !== undefined && event.totalCargoCapacity > 0) {
      routeLines.push(`📦 **Cargo Capacity:** ${event.totalCargoCapacity.toLocaleString()} SCU`);
    }

    if (event.totalQuantumFuel !== undefined && event.totalQuantumFuelRequired !== undefined) {
      const fuelBar = createProgressBar(event.totalQuantumFuelRequired, event.totalQuantumFuel, {
        width: 10,
        showPercentage: false,
      });
      const sufficient = event.totalQuantumFuelRequired <= event.totalQuantumFuel;
      const icon = sufficient ? '✅' : '⚠️';
      routeLines.push(
        `⛽ **Quantum Fuel:** ${fuelBar}  ${event.totalQuantumFuelRequired.toLocaleString()} / ${event.totalQuantumFuel.toLocaleString()} SCU ${icon}`
      );
    } else if (event.totalQuantumFuel !== undefined) {
      routeLines.push(`⛽ **Quantum Fuel:** ${event.totalQuantumFuel.toLocaleString()} SCU`);
    }

    if (event.maxJumpRange !== undefined && event.maxJumpRange > 0) {
      routeLines.push(`🎯 **Max Jump Range:** ${(event.maxJumpRange / 1000).toLocaleString()} Mkm`);
    }

    if (event.hasRefuelShip) {
      routeLines.push(`⛽ **Refuel Ship Present** (unlimited range)`);
    }

    if (routeLines.length > 0) {
      builder.addFields(
        withFieldBudget({
          name: '🗺️ Fleet Logistics',
          value: routeLines.join('\n'),
          inline: false,
        })
      );
    }
  }

  /* ─── Tags ────────────────────────────────────────────────────── */
  if (event.tags && event.tags.length > 0) {
    builder.addFields(
      withFieldBudget({
        name: '🔖 Tags',
        value: event.tags.map(t => `\`${t}\``).join('  '),
        inline: false,
      })
    );
  }

  /* ─── Languages ───────────────────────────────────────────────── */
  if (event.languages && event.languages.length > 0) {
    builder.addFields(
      withFieldBudget({
        name: '🌐 Languages',
        value: event.languages.map(l => `\`${l.toUpperCase()}\``).join('  '),
        inline: true,
      })
    );
  }

  /* ─── Section separator: fleet/tags → participants ────────────── */
  if (buckets.accepted.length > 0 || buckets.tentative.length > 0) {
    builder.addFields(withFieldBudget({ name: '\u200B', value: '\u200B', inline: false }));
  }

  /* ─── Accepted participant grid (crew members shown under ships) ─ */
  if (buckets.accepted.length > 0) {
    // Collect user IDs of everyone listed as crew on any ship
    const crewUserIds = new Set<string>();
    if (event.ships) {
      for (const ship of event.ships) {
        for (const c of ship.crewMembers) {
          crewUserIds.add(c.userId);
        }
      }
    }

    const nonCrewAccepted = buckets.accepted.filter(p => !crewUserIds.has(p.userId));
    if (nonCrewAccepted.length > 0) {
      const lines = formatAcceptedLines(buckets.accepted, crewUserIds);
      builder.addFields(
        withFieldBudget({
          name: `✅ Participants (${nonCrewAccepted.length})`,
          value: lines.join('\n') + overflow(nonCrewAccepted.length, 15),
          inline: true,
        })
      );
    }
  }

  /* ─── Tentative participants ──────────────────────────────────── */
  if (buckets.tentative.length > 0) {
    const lines = buckets.tentative.slice(0, 10).map(p => `❓ ${mentionUser(p)}`);
    builder.addFields(
      withFieldBudget({
        name: `❓ Tentative (${buckets.tentative.length})`,
        value: lines.join('\n') + overflow(buckets.tentative.length, 10),
        inline: true,
      })
    );
  }

  /* ─── Footer ──────────────────────────────────────────────────── */
  let ownerFooterPart: string | undefined;
  if (event.organizationName) {
    ownerFooterPart = event.organizationName;
  } else if (event.creatorName) {
    ownerFooterPart = `by ${decodeHtmlEntities(event.creatorName)}`;
  }
  const footerParts = [
    `ID: ${event.id}`,
    ...(ownerFooterPart ? [ownerFooterPart] : []),
    'Last updated',
    RSVP_LEGEND,
  ];
  const footerTimestamp = new Date(event.updatedAt ?? event.postedAt);
  builder.setFooter({ text: footerParts.join('  •  ') }).setTimestamp(footerTimestamp);

  return builder.build().setURL(webEventUrl);
}

/**
 * Builds the RSVP action row with 4 buttons.
 *
 * These are the high-frequency RSVP actions, so they render icon-only to keep
 * the row compact. The icon legend is shown in the embed footer (see
 * RSVP_LEGEND) so meaning stays discoverable without per-button labels.
 *
 * CustomId format: event_{action}_{activityId}
 */
export function buildEventButtons(activityId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_join_${activityId}`)
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`event_tentative_${activityId}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji('❓'),
    new ButtonBuilder()
      // Neutral (grey) style so the red ❌ icon stays legible — a red icon on a
      // red Danger button blends together and is hard to read.
      .setCustomId(`event_decline_${activityId}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌'),
    new ButtonBuilder()
      .setCustomId(`event_leave_${activityId}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📤')
  );
}

/**
 * Parses an event button customId to extract action and activity ID.
 * e.g., 'event_join_abc123' → { action: 'join', activityId: 'abc123' }
 */
export function parseEventButtonId(customId: string): {
  action:
    | 'join'
    | 'tentative'
    | 'decline'
    | 'leave'
    | 'actions'
    | 'bringship'
    | 'removeship'
    | 'joincrew'
    | 'leavecrew'
    | 'requestship'
    | 'joinpassenger'
    | 'leavepassenger'
    | 'manageslots'
    | 'bringfleet'
    | 'remindme'
    | 'edit'
    | 'clone'
    | 'cancel'
    | 'confirmcancel'
    | 'canceldismiss';
  activityId: string;
} | null {
  const match =
    /^event_(join|tentative|decline|leave|actions|bringship|removeship|joincrew|leavecrew|requestship|joinpassenger|leavepassenger|manageslots|bringfleet|remindme|edit|clone|cancel|confirmcancel|canceldismiss)_(.+)$/.exec(
      customId
    );
  if (!match) {
    return null;
  }
  return {
    action: match[1] as
      | 'join'
      | 'tentative'
      | 'decline'
      | 'leave'
      | 'actions'
      | 'bringship'
      | 'removeship'
      | 'joincrew'
      | 'leavecrew'
      | 'requestship'
      | 'joinpassenger'
      | 'leavepassenger'
      | 'manageslots'
      | 'bringfleet'
      | 'remindme'
      | 'edit'
      | 'clone'
      | 'cancel'
      | 'confirmcancel'
      | 'canceldismiss',
    activityId: match[2],
  };
}

/**
 * Builds the "Ship & Crew" trigger button plus a personal "Remind Me" button,
 * shown on the public event message (second row, below the RSVP buttons).
 *
 * "Ship & Crew" opens an ephemeral action panel (see buildEventActionPanelComponents)
 * that groups the less-frequent ship / crew / passenger actions, keeping the
 * public message compact. "Remind Me" sets a personal one-click reminder for the
 * clicking user (any participant can use it).
 *
 * CustomId format: event_actions_{activityId} / event_remindme_{activityId}
 */
export function buildEventActionsRow(activityId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_actions_${activityId}`)
      .setLabel('Ship & Crew')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🚀'),
    new ButtonBuilder()
      .setCustomId(`event_remindme_${activityId}`)
      .setLabel('Remind Me')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔔')
  );
}

/**
 * Builds the ephemeral "Ship & Crew" action panel opened by the trigger button.
 *
 * Row 1 groups the contribute / join actions; row 2 groups the leave / remove /
 * request actions. Each button reuses the same customId its standalone button
 * used previously, so the existing handlers in eventButtons.ts dispatch them
 * unchanged. Per-action permission checks (e.g. Bring Fleet leadership, Remove
 * Ship ownership) live in those handlers, so the panel itself needs no gating.
 *
 * CustomId format: event_{action}_{activityId}
 */
export function buildEventActionPanelComponents(
  activityId: string
): ActionRowBuilder<ButtonBuilder>[] {
  const contributeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_bringship_${activityId}`)
      .setLabel('Bring Ship')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🚀'),
    new ButtonBuilder()
      .setCustomId(`event_bringfleet_${activityId}`)
      .setLabel('Bring Fleet')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🛰️'),
    new ButtonBuilder()
      .setCustomId(`event_joincrew_${activityId}`)
      .setLabel('Join Crew')
      .setStyle(ButtonStyle.Success)
      .setEmoji('⚙️'),
    new ButtonBuilder()
      .setCustomId(`event_joinpassenger_${activityId}`)
      .setLabel('Join as Passenger')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💺')
  );

  const manageRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_manageslots_${activityId}`)
      .setLabel('Manage Slots')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🪑'),
    new ButtonBuilder()
      .setCustomId(`event_removeship_${activityId}`)
      .setLabel('Remove Ship')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️'),
    new ButtonBuilder()
      .setCustomId(`event_leavecrew_${activityId}`)
      .setLabel('Leave Crew')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️'),
    new ButtonBuilder()
      .setCustomId(`event_leavepassenger_${activityId}`)
      .setLabel('Leave Seat')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚪'),
    new ButtonBuilder()
      .setCustomId(`event_requestship_${activityId}`)
      .setLabel('Request Ships')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋')
  );

  return [contributeRow, manageRow];
}

/**
 * Builds the organiser-only manage row (shown when `includeManage` is true).
 *
 * Holds the high-level event-management actions: edit the event, generate a
 * mirror invite code for it, clone it into a fresh draft, and cancel it. Per-ship
 * slot management lives in the ephemeral "Ship & Crew" panel instead (see
 * buildEventActionPanelComponents) so individual ship owners can manage their own
 * ships' slots without organiser rights.
 *
 * CustomId format: event_{action}_{activityId}
 */
export function buildCancelButton(activityId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_edit_${activityId}`)
      .setLabel('Edit Event')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId(`event_mirrorcreate_${activityId}`)
      .setLabel('Mirror')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🪞'),
    new ButtonBuilder()
      .setCustomId(`event_mirrorresync_${activityId}`)
      .setLabel('Resync')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId(`event_clone_${activityId}`)
      .setLabel('Clone')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId(`event_cancel_${activityId}`)
      .setLabel('Cancel Event')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🛑')
  );
}

/**
 * Assemble the standard action rows for an event message.
 *
 * Order: RSVP → "Ship & Crew" trigger → (creator-only edit/cancel). The
 * less-frequent ship / crew / passenger actions live behind the trigger button
 * in an ephemeral panel (see buildEventActionPanelComponents) to keep the public
 * message compact. Discord caps a message at 5 action rows; we stay within that.
 * The cancel/edit row is included only when `includeManage` is true (active +
 * creator/organizer).
 */
export function buildEventComponentRows(
  activityId: string,
  options: { includeManage?: boolean } = {}
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [
    buildEventButtons(activityId),
    buildEventActionsRow(activityId),
  ];
  if (options.includeManage) {
    rows.push(buildCancelButton(activityId));
  }
  return rows;
}
