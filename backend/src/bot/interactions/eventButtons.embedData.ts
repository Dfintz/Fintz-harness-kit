/**
 * Embed-data assembly for the event interaction handlers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the logic
 * that turns an `Activity` (plus its participants and ship assignments) into the
 * render-ready `EventEmbedData` its own ownership boundary, separate from the Discord
 * interaction handlers.
 *
 * The three exported functions form one pipeline used by every embed re-render:
 * `collectUserIdsForEmbed` gathers the internal user IDs an activity references,
 * `resolveDiscordIdMap` bulk-translates them to Discord snowflakes (so the embed can
 * render real `<@id>` mentions), and `buildEmbedDataFromActivity` assembles the final
 * `EventEmbedData`. They are consumed both here and externally (the mirrored-event
 * renderer and the event edit wizard), so `eventButtons.ts` re-exports them.
 *
 * The module depends only on data/embed collaborators and the requirement helpers — it
 * never imports `eventButtons.ts`, keeping the import graph acyclic (one-way: handlers
 * → embed-data).
 */
import { In } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { type ShipRequirement } from '../constants/shipTaxonomy';
import { EmbedShipAssignment, EventEmbedData } from '../embeds/eventEmbed';

import { computeFilledCounts, parseRequiredShipTypes } from './eventButtons.requirements';

/**
 * Shape of a participant record fed into `buildEmbedDataFromActivity`.
 *
 * Matches both the deprecated JSON column entries on `Activity.participants`
 * and the rows from the normalized `activity_participants` table, so the
 * embed builder can be fed from either source.
 */
type EmbedParticipantInput = {
  userId: string;
  userName?: string | null;
  status: string;
  role?: string | null;
  shipType?: string | null;
  shipName?: string | null;
  crewPosition?: string | null;
  crewShipId?: string | null;
  /**
   * Discord snowflake for this user. Resolved out-of-band before rendering
   * so the embed can produce a real `<@id>` mention instead of leaking the
   * raw internal UUID.
   */
  discordUserId?: string | null;
};

/** Deduplicate ships by id or ownerId+shipType composite key. */
function deduplicateShips<T extends { id?: string; ownerId: string; shipType: string }>(
  ships: T[]
): T[] {
  const seen = new Set<string>();
  return ships.filter(s => {
    const key = s.id ?? `${s.ownerId}_${s.shipType}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildEmbedDataFromActivity(
  activity: {
    id: string;
    title: string;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    description?: string | null;
    location?: string | null;
    scheduledStartDate?: Date | null;
    creatorId?: string | null;
    creatorName?: string | null;
    activityType?: string;
    status?: string;
    requiredShipTypes?: string | null; // JSON string: ShipRequirement[] or string[]
    bannerImageUrl?: string | null;
    participants?: Array<{
      userId: string;
      userName?: string;
      status: string;
      role?: string;
      shipType?: string;
      shipName?: string;
      crewPosition?: string;
      crewShipId?: string;
    }>;
    ships?: Array<{
      id?: string;
      shipType: string;
      shipName?: string;
      ownerId: string;
      ownerName: string;
      captainId?: string;
      captainName?: string;
      role?: string;
      crewCapacity: number;
      crewAssigned: number;
      crewMembers?: Array<{ userId: string; userName: string; position: string }>;
      crew?: Array<{ userId: string; userName: string; position: string }>;
      status?: string;
      loanerShip?: string;
      cargo?: number;
      vehicleCargo?: number;
      hangarSize?: string;
      fleetId?: string;
      fleetName?: string;
      parentShipId?: string;
      isTransported?: boolean;
      transportType?: string;
    }>;
    shipAssignments?: Array<{
      id?: string;
      shipId?: string;
      shipType: string;
      shipName?: string;
      ownerId: string;
      ownerName: string;
      captainId?: string;
      captainName?: string;
      role?: string;
      crewCapacity: number;
      crewAssigned: number;
      crewMembers?: Array<{ userId: string; userName: string; position: string }>;
      crew?: Array<{ userId: string; userName: string; position: string }>;
      status?: string;
      metadata?: { loanerShip?: string; cargoCapacity?: number; [key: string]: unknown };
      fleetId?: string;
      fleetName?: string;
      parentShipId?: string;
      isTransported?: boolean;
      transportType?: string;
    }>;
    roleRequirements?: unknown;
    maxParticipants?: number | null;
    voiceChannelId?: string | null;
  },
  /**
   * Override the participants list. Pass rows fetched from the normalized
   * `activity_participants` table — the deprecated `activity.participants`
   * JSON column is `select: false` and undefined on default queries.
   */
  participantsOverride?: EmbedParticipantInput[],
  /**
   * Map of internal `userId` (UUID) → Discord snowflake. Used to render
   * real `<@id>` mentions for participants and crew. Anyone missing from
   * the map falls back to a `**username**` rendering in the embed.
   */
  discordIdMap?: Map<string, string>
): EventEmbedData {
  // Merge and deduplicate ships from both columns
  const uniqueShips = deduplicateShips([
    ...(activity.ships ?? []),
    ...(activity.shipAssignments ?? []),
  ]);

  // --- Parse requiredShipTypes into structured ShipRequirement[] ---
  const parsedRequirements = parseRequiredShipTypes(activity.requiredShipTypes);
  const shipRequestsByRole: ShipRequirement[] | undefined =
    parsedRequirements.length > 0 ? parsedRequirements : undefined;

  // Compute fill counts against committed ships
  if (shipRequestsByRole && uniqueShips.length > 0) {
    computeFilledCounts(shipRequestsByRole, uniqueShips);
  }

  return {
    id: activity.id,
    title: activity.title,
    type: activity.activityType ?? 'event',
    status: activity.status ?? 'open',
    description: activity.description ?? undefined,
    location: activity.location ?? undefined,
    startDate: activity.scheduledStartDate ?? undefined,
    creatorId: activity.creatorId ?? undefined,
    creatorName: activity.creatorName ?? undefined,
    bannerImageUrl: activity.bannerImageUrl ?? undefined,
    voiceChannelId: activity.voiceChannelId ?? undefined,
    postedAt: activity.createdAt ?? activity.updatedAt ?? new Date(),
    updatedAt: activity.updatedAt ?? activity.createdAt ?? undefined,
    shipRequestsByRole,
    participants: (participantsOverride ?? activity.participants)?.map(p => ({
      userId: p.userId,
      userName: p.userName ?? undefined,
      discordUserId: discordIdMap?.get(p.userId) ?? undefined,
      status: p.status,
      role: p.role ?? undefined,
      shipType: p.shipType ?? undefined,
      shipName: p.shipName ?? undefined,
      crewPosition: p.crewPosition ?? undefined,
      crewShipId: p.crewShipId ?? undefined,
    })),
    ships:
      uniqueShips.length > 0
        ? uniqueShips.map((s): EmbedShipAssignment => ({
            id: s.id ?? '',
            shipType: s.shipType,
            shipName: s.shipName,
            ownerId: s.ownerId,
            ownerName: s.ownerName,
            captainId: s.captainId,
            captainName: s.captainName,
            role: s.role,
            crewCapacity: s.crewCapacity,
            crewAssigned: s.crewAssigned,
            crewMembers: (s.crewMembers ?? s.crew ?? []).map(c => ({
              userId: c.userId,
              userName: c.userName,
              position: c.position,
              discordUserId: discordIdMap?.get(c.userId) ?? undefined,
            })),
            status: s.status,
            loanerShip:
              ('loanerShip' in s ? (s as { loanerShip?: string }).loanerShip : undefined) ??
              (('metadata' in s &&
                (s as { metadata?: { loanerShip?: string } }).metadata?.loanerShip) ||
                undefined),
            cargo:
              ('cargo' in s ? (s as { cargo?: number }).cargo : undefined) ??
              ('metadata' in s &&
              typeof (s as { metadata?: { cargoCapacity?: number } }).metadata?.cargoCapacity ===
                'number'
                ? (s as { metadata: { cargoCapacity: number } }).metadata.cargoCapacity
                : undefined),
            vehicleCargo:
              'vehicleCargo' in s ? (s as { vehicleCargo?: number }).vehicleCargo : undefined,
            hangarSize: 'hangarSize' in s ? (s as { hangarSize?: string }).hangarSize : undefined,
            fleetId: 'fleetId' in s ? (s as { fleetId?: string }).fleetId : undefined,
            fleetName: 'fleetName' in s ? (s as { fleetName?: string }).fleetName : undefined,
            parentShipId:
              'parentShipId' in s ? (s as { parentShipId?: string }).parentShipId : undefined,
            isTransported:
              'isTransported' in s ? (s as { isTransported?: boolean }).isTransported : undefined,
            transportType:
              'transportType' in s
                ? ((s as { transportType?: string })
                    .transportType as EmbedShipAssignment['transportType'])
                : undefined,
            passengers:
              'passengers' in s
                ? (s as { passengers?: EmbedShipAssignment['passengers'] }).passengers
                : undefined,
          }))
        : undefined,
    roleRequirements: activity.roleRequirements as EventEmbedData['roleRequirements'],
    maxParticipants: activity.maxParticipants ?? undefined,
  };
}

/**
 * Bulk-resolve internal user UUIDs to Discord snowflakes.
 *
 * Without this lookup, `<@${userId}>` in embeds renders as raw text
 * (e.g. `<@257e31b8-…>`) because Discord only mention-renders numeric
 * snowflakes. Users that haven't linked a Discord account simply won't
 * appear in the map, and the embed falls back to a `**username**`
 * rendering.
 */
export async function resolveDiscordIdMap(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) {
    return map;
  }
  try {
    const userRepo = AppDataSource.getRepository(User);

    // Partition: UUIDs (contain hyphens) vs Discord snowflakes (numeric strings)
    const uuids = unique.filter(id => id.includes('-'));
    const snowflakes = unique.filter(id => !id.includes('-') && /^\d+$/.test(id));

    // Batch 1: look up by internal UUID
    if (uuids.length > 0) {
      const byId = await userRepo.find({
        where: { id: In(uuids) },
        select: ['id', 'discordId'],
      });
      for (const u of byId) {
        if (u.discordId) {
          map.set(u.id, u.discordId);
        }
      }
    }

    // Batch 2: look up by Discord snowflake (legacy participants stored with Discord ID)
    if (snowflakes.length > 0) {
      const byDiscord = await userRepo.find({
        where: { discordId: In(snowflakes) },
        select: ['id', 'discordId'],
      });
      for (const u of byDiscord) {
        if (u.discordId) {
          map.set(u.discordId, u.discordId); // snowflake → snowflake (already correct)
          map.set(u.id, u.discordId); // also map internal id → snowflake
        }
      }
    }
  } catch (err) {
    logger.warn('Failed to resolve Discord IDs for embed mentions', {
      error: err instanceof Error ? err.message : String(err),
      userCount: unique.length,
    });
  }
  return map;
}

/**
 * Collect every internal userId referenced by an activity's participants
 * and ship crew so we can do a single bulk Discord-ID lookup before
 * rendering the embed.
 */
export function collectUserIdsForEmbed(
  activity: { ships?: unknown; shipAssignments?: unknown },
  participants: ReadonlyArray<{ userId: string }>
): string[] {
  const ids: string[] = participants.map(p => p.userId);
  const ships = [
    ...((activity.ships as
      | Array<{ crewMembers?: Array<{ userId?: string }>; crew?: Array<{ userId?: string }> }>
      | undefined) ?? []),
    ...((activity.shipAssignments as
      | Array<{ crewMembers?: Array<{ userId?: string }>; crew?: Array<{ userId?: string }> }>
      | undefined) ?? []),
  ];
  for (const s of ships) {
    for (const c of s.crewMembers ?? s.crew ?? []) {
      if (c.userId) {
        ids.push(c.userId);
      }
    }
  }
  return ids;
}
