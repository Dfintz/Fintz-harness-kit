/**
 * Discord utility functions shared across bot commands.
 */

import type { Guild, GuildMember, PermissionResolvable, TextBasedChannel } from 'discord.js';
import { PermissionsBitField } from 'discord.js';

/**
 * Escape Discord markdown special characters in user input.
 * Escapes single-character markdown tokens. Multi-character sequences
 * like __ (underline) and || (spoiler) are handled implicitly since
 * their constituent characters are individually escaped.
 */
export function escapeDiscordMarkdown(text: string): string {
  return text.replaceAll(/[*`_~[\]()\\>|]/g, '\\$&');
}

/**
 * Check whether the bot has the required permissions in a guild.
 * Returns `true` if all permissions are satisfied, `false` otherwise.
 */
export function checkBotGuildPermissions(
  guild: Guild,
  ...permissions: PermissionResolvable[]
): boolean {
  const me = guild.members.me;
  if (!me) {
    return false;
  }
  return me.permissions.has(permissions);
}

/**
 * Check whether the bot has the required permissions in a specific channel.
 * Channel-level overrides can restrict guild-level permissions, so this is
 * more accurate for send/manage operations scoped to a single channel.
 */
export function checkBotChannelPermissions(
  channel: TextBasedChannel,
  ...permissions: PermissionResolvable[]
): boolean {
  if (!('guild' in channel) || !channel.guild) {
    return true; // DM channels — bot always has perms
  }
  const me = channel.guild.members.me;
  if (!me) {
    return false;
  }
  const perms = channel.permissionsFor(me);
  return perms ? perms.has(permissions) : false;
}

/**
 * Returns a human-readable comma-separated list of missing permissions.
 * Useful for building "I need X, Y, Z" error messages.
 */
export function getMissingPermissions(
  member: GuildMember,
  ...permissions: PermissionResolvable[]
): string[] {
  const resolved = new PermissionsBitField(permissions);
  const missing: string[] = [];
  for (const [name, bit] of Object.entries(PermissionsBitField.Flags)) {
    if (resolved.has(bit) && !member.permissions.has(bit)) {
      missing.push(name);
    }
  }
  return missing;
}
