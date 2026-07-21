/**
 * Phase 3.4 — Platform → Discord role sync (additive only).
 *
 * Subscribes to `member:platform_role_changed` and adds the mapped Discord
 * role to the user's Discord member.  This is intentionally ADDITIVE only:
 * removing a Discord role requires an explicit moderator action so an
 * accidental web-side role downgrade can never strip Discord permissions.
 *
 * Per-org gate: skipped unless DiscordGuildSettings.roleSyncSettings.enabled
 * is true and a roleMappings entry exists for the new role name.
 *
 * Sharding caveat: client.guilds.cache is shard-local. Mutations targeting a
 * guild on another shard are silently no-ops here. Cross-shard role sync
 * would require an IPC hop (out of plan scope).
 */
import type { Client } from 'discord.js';

import { AppDataSource } from '../../data-source';
import { User } from '../../models/User';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { domainEvents } from '../../services/shared/DomainEventBus';
import { logger } from '../../utils/logger';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mappedRoleIdsForRank(
  roleMappings: Record<string, string | string[]> | undefined,
  rankName: string
): string[] {
  const value = roleMappings?.[rankName];
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return [value];
}

async function applyRoleAddition(
  client: Client,
  guildId: string,
  discordUserId: string,
  discordRoleId: string
): Promise<void> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    // Guild lives on another shard — skip silently.
    return;
  }
  try {
    const member = await guild.members.fetch(discordUserId);
    if (member.roles.cache.has(discordRoleId)) {
      return;
    }
    await member.roles.add(
      discordRoleId,
      'Platform role change synced from sc-fleet-manager (additive)'
    );
    logger.info('Synced platform role to Discord', {
      guildId,
      discordUserId,
      discordRoleId,
    });
  } catch (err) {
    logger.warn('Failed to sync platform role to Discord', {
      guildId,
      discordUserId,
      discordRoleId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function registerRoleSyncListener(client: Client): void {
  const settingsSvc = discordSettingsService;

  domainEvents.on('member:platform_role_changed', async payload => {
    try {
      if (!UUID_PATTERN.test(payload.userId)) {
        logger.warn('member:platform_role_changed payload has invalid userId', {
          userId: payload.userId,
          organizationId: payload.organizationId,
        });
        return;
      }

      // 1) Resolve the user's Discord ID.
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo
        .createQueryBuilder('user')
        .select(['user.id', 'user.discordId'])
        .where('user.id = :userId', { userId: payload.userId })
        .getOne();
      if (!user?.discordId) {
        return; // Unlinked users can't be synced.
      }

      // 2) Look up all Discord guilds linked to this org.
      const orgSettings = await settingsSvc.getOrganizationSettings(payload.organizationId);

      // 3) For each guild, find the mapped Discord role for the new platform role.
      const tasks: Array<Promise<void>> = [];
      for (const settings of orgSettings) {
        const sync = settings.roleSyncSettings;
        if (!sync?.enabled || !settings.guildId) {
          continue;
        }
        const discordRoleIds = mappedRoleIdsForRank(sync.roleMappings, payload.newRoleName);
        if (discordRoleIds.length === 0) {
          continue; // No mapping for this role — skip silently.
        }

        for (const discordRoleId of discordRoleIds) {
          tasks.push(applyRoleAddition(client, settings.guildId, user.discordId, discordRoleId));
        }
      }

      await Promise.allSettled(tasks);
    } catch (err) {
      logger.warn('member:platform_role_changed handler failed', {
        userId: payload.userId,
        organizationId: payload.organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info('Registered platform-role-changed → Discord role sync listener');
}
