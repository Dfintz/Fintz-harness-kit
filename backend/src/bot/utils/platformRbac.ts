import type { ChatInputCommandInteraction, RepliableInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';

import { UserService } from '../../services/user/UserService';
import { logger } from '../../utils/logger';

/**
 * Centralized platform-level RBAC checks for Discord bot commands.
 *
 * Discord guild permissions (e.g. `setDefaultMemberPermissions(ManageGuild)`)
 * cover *guild-scoped* admin operations. This module covers the orthogonal
 * axis: **platform-level** privileges — operations that cross guild boundaries
 * or affect global state (e.g. global announcement templates, federation
 * approvals, platform-wide diagnostics).
 *
 * Roles considered platform admin: `'admin'`, `'superadmin'`.
 *
 * Lookups are cached per Discord user for {@link CACHE_TTL_MS} ms to keep
 * common command paths off the hot DB path. The cache is invalidated by TTL
 * only — role changes propagate within {@link CACHE_TTL_MS}.
 */

const PLATFORM_ADMIN_ROLES = new Set(['admin', 'superadmin']);
const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;

interface CacheEntry {
  isAdmin: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

let userServiceFactory: () => UserService = () => new UserService();

/**
 * Test-only hook to inject a UserService factory. Resets the cache.
 */
export function __setUserServiceFactoryForTesting(factory: () => UserService): void {
  userServiceFactory = factory;
  cache.clear();
}

/**
 * Test-only hook to clear the cache between tests.
 */
export function __clearPlatformRbacCacheForTesting(): void {
  cache.clear();
}

function pruneCacheIfNeeded(): void {
  if (cache.size <= CACHE_MAX_ENTRIES) {
    return;
  }
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
  // If still over cap, drop oldest insertion-order entries.
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    cache.delete(oldestKey);
  }
}

/**
 * Returns true if the Discord user maps to a platform admin / superadmin.
 *
 * On lookup error returns false (fail closed).
 */
export async function isPlatformAdmin(discordId: string): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(discordId);
  if (cached && cached.expiresAt > now) {
    return cached.isAdmin;
  }

  let isAdmin = false;
  try {
    const user = await userServiceFactory().getUserByDiscordId(discordId);
    isAdmin = !!user && PLATFORM_ADMIN_ROLES.has(user.role);
  } catch (error) {
    logger.error('platformRbac: isPlatformAdmin lookup failed', {
      error: error instanceof Error ? error.message : String(error),
      discordId,
    });
    isAdmin = false;
  }

  cache.set(discordId, { isAdmin, expiresAt: now + CACHE_TTL_MS });
  pruneCacheIfNeeded();
  return isAdmin;
}

/**
 * Guard helper: replies with an ephemeral denial and returns false if the
 * invoking user is not a platform admin. Returns true otherwise without
 * touching the interaction.
 *
 * Intended call site:
 * ```ts
 * if (!(await requirePlatformAdmin(interaction))) return;
 * ```
 */
export async function requirePlatformAdmin(
  interaction: ChatInputCommandInteraction | RepliableInteraction
): Promise<boolean> {
  if (await isPlatformAdmin(interaction.user.id)) {
    return true;
  }
  const reply = {
    content: '❌ This action requires platform administrator privileges.',
    flags: MessageFlags.Ephemeral,
  } as const;
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(reply).catch(() => {});
  } else {
    await interaction.reply(reply).catch(() => {});
  }
  return false;
}
