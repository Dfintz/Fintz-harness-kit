import { EventRole, LFGActivity } from '../../types';

/**
 * Shared emoji maps for Discord bot embeds and messages.
 * Centralizes emoji constants to avoid duplication across commands and embed builders.
 */

/**
 * Gets an emoji for an event participant role.
 */
export function getRoleEmoji(role: EventRole | string): string {
  switch (role) {
    case EventRole.PILOT:
      return '✈️';
    case EventRole.ENGINEER:
      return '🔧';
    case EventRole.GUNNER:
      return '🎯';
    case EventRole.MEDIC:
      return '⚕️';
    case EventRole.VEHICLE_OPERATOR:
      return '🚗';
    case EventRole.MARINE:
      return '⚔️';
    case EventRole.GROUND_SUPPORT:
      return '🛡️';
    // Legacy roles (kept for backward compatibility)
    case EventRole.TANK:
      return '🛡️';
    case EventRole.DPS:
      return '⚔️';
    case EventRole.SUPPORT:
      return '💚';
    case EventRole.ANY:
      return '⭐';
    default:
      return '👤';
  }
}

/**
 * Gets an emoji for an LFG activity type.
 */
export function getLfgActivityEmoji(activity: LFGActivity | string): string {
  switch (activity) {
    case LFGActivity.PVP:
      return '⚔️';
    case LFGActivity.PVE:
      return '🎮';
    case LFGActivity.MINING:
      return '⛏️';
    case LFGActivity.TRADING:
      return '📦';
    case LFGActivity.EXPLORATION:
      return '🔭';
    case LFGActivity.BOUNTY_HUNTING:
      return '🎯';
    case LFGActivity.CARGO_HAULING:
      return '🚚';
    case LFGActivity.RACING:
      return '🏁';
    case LFGActivity.OTHER:
      return '❓';
    default:
      return '🎮';
  }
}

/**
 * Gets a status emoji for LFG posts.
 */
export function getLfgStatusEmoji(status: string): string {
  switch (status) {
    case 'open':
      return '🟢';
    case 'full':
      return '🟡';
    case 'closed':
      return '🔴';
    default:
      return '⚪';
  }
}
