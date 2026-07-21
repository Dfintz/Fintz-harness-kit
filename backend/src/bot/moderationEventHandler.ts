import { AuditLogEvent, Client, GuildBan, GuildMember, PartialGuildMember } from 'discord.js';

import {
  IncidentStatus,
  IncidentType,
  LONG_TIMEOUT_THRESHOLD_MINUTES,
  ModerationIncident,
} from '../models/ModerationIncident';
import { BlacklistSharingService } from '../services/discord/BlacklistSharingService';
import { GuildOrganizationService } from '../services/discord/GuildOrganizationService';
import { ModerationIncidentService } from '../services/discord/ModerationIncidentService';
import { domainEvents } from '../services/shared/DomainEventBus';
import { logger } from '../utils/logger';

import { botApiClient } from './utils/botApiClient';

let _services: {
  incidentService: ModerationIncidentService;
  sharingService: BlacklistSharingService;
  guildOrgService: GuildOrganizationService;
} | null = null;

function getServices() {
  _services ??= {
    incidentService: ModerationIncidentService.getInstance(),
    sharingService: BlacklistSharingService.getInstance(),
    guildOrgService: GuildOrganizationService.getInstance(),
  };
  return _services;
}

// System user ID for auto-detected incidents (should be configurable)
const SYSTEM_USER_ID = 'system';

/**
 * Initialize moderation event handlers for automatic incident detection
 * @param client Discord.js client instance
 */
export function initializeModerationEventHandlers(client: Client): void {
  // Handle guild bans (severity 5)
  client.on('guildBanAdd', async (ban: GuildBan) => {
    try {
      await handleGuildBanAdd(ban);
    } catch (error) {
      logger.error('Error handling guildBanAdd event:', error);
    }
  });

  // Handle guild ban removals (for tracking unbans)
  client.on('guildBanRemove', async (ban: GuildBan) => {
    try {
      await handleGuildBanRemove(ban);
    } catch (error) {
      logger.error('Error handling guildBanRemove event:', error);
    }
  });

  // Handle member updates (timeouts)
  client.on(
    'guildMemberUpdate',
    async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
      try {
        await handleGuildMemberUpdate(oldMember, newMember);
      } catch (error) {
        logger.error('Error handling guildMemberUpdate event:', error);
      }
    }
  );

  // Handle member removals (kicks - need audit log to differentiate from leaves)
  client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
    try {
      await handleGuildMemberRemove(member);
    } catch (error) {
      logger.error('Error handling guildMemberRemove event:', error);
    }
  });

  logger.info('🛡️ Moderation event handlers initialized');
}

/**
 * Handle guild ban add event
 */
async function handleGuildBanAdd(ban: GuildBan): Promise<void> {
  const guild = ban.guild;
  const user = ban.user;

  logger.info(`Ban detected: ${user.tag} in ${guild.name}`, {
    guildId: guild.id,
    userId: user.id,
  });

  // Fetch audit log to get moderator and reason
  const moderatorId = SYSTEM_USER_ID;
  let moderatorDiscordId: string | undefined;
  let moderatorUsername = 'Unknown Moderator';
  let reason = ban.reason || 'No reason provided';
  let auditLogId: string | undefined;

  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberBanAdd,
      limit: 1,
    });

    const entry = auditLogs.entries.first();
    if (entry && entry.target?.id === user.id) {
      moderatorDiscordId = entry.executor?.id;
      moderatorUsername = entry.executor?.username || 'Unknown Moderator';
      reason = entry.reason || reason;
      auditLogId = entry.id;
    }
  } catch (error) {
    logger.warn('Could not fetch audit logs for ban:', error);
  }

  // Resolve organization ID from guild ID using proper mapping.
  // If the guild has no org mapping, drop the event rather than corrupting tenant data
  // by writing an incident with organizationId = guildId snowflake.
  const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
  if (!organizationId) {
    logger.warn(
      `Skipping ban incident for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`
    );
    return;
  }

  const incident = await getServices().incidentService.createFromDiscordEvent(
    organizationId,
    moderatorId,
    guild.id,
    guild.name,
    user.id,
    user.username,
    moderatorDiscordId || SYSTEM_USER_ID,
    moderatorUsername,
    IncidentType.BAN,
    reason,
    undefined, // Bans don't have duration
    auditLogId
  );

  // Emit domain event for audit subscribers (Wave 2.1)
  domainEvents.emit('member:moderation_action', {
    timestamp: new Date().toISOString(),
    userId: user.id,
    organizationId,
    incidentId: incident.id,
    incidentType: IncidentType.BAN,
    severity: incident.severity,
    moderatorId: moderatorDiscordId || SYSTEM_USER_ID,
    reason,
    isShared: false,
  });

  domainEvents.emit('member:discord_left', {
    timestamp: new Date().toISOString(),
    userId: user.id,
    discordId: user.id,
    discordUsername: user.username,
    guildId: guild.id,
    guildName: guild.name,
    organizationId,
    reason: 'ban',
  });

  // Phase 2: Auto-share with allies if configured
  await autoShareIncidentWithAllies(incident, organizationId);
}

/**
 * Handle guild ban remove event - revoke active ban incidents
 *
 * Looks up all ACTIVE BAN incidents for this user in this guild's organization
 * and marks them as REVOKED. Attempts to identify the unbanning moderator via
 * the guild audit log; falls back to SYSTEM_USER_ID if not available.
 */
async function handleGuildBanRemove(ban: GuildBan): Promise<void> {
  const guild = ban.guild;
  const user = ban.user;

  logger.info(`Unban detected: ${user.tag} in ${guild.name}`, {
    guildId: guild.id,
    userId: user.id,
  });

  // Identify the unbanning moderator from the audit log (best-effort)
  let moderatorDiscordId: string | undefined;
  let moderatorUsername = 'Unknown Moderator';
  let auditReason: string | undefined;

  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberBanRemove,
      limit: 5,
    });
    const entry = auditLogs.entries.find(e => e.target?.id === user.id);
    if (entry) {
      moderatorDiscordId = entry.executor?.id;
      moderatorUsername = entry.executor?.username || moderatorUsername;
      auditReason = entry.reason || undefined;
    }
  } catch (error) {
    logger.warn('Could not fetch audit logs for unban:', error);
  }

  // Resolve organization for this guild
  const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
  if (!organizationId) {
    logger.warn(
      `Skipping unban revocation for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`
    );
    return;
  }

  // Find active BAN incidents for this user in this guild
  let summary;
  try {
    summary = await getServices().incidentService.lookupUser(organizationId, user.id, false);
  } catch (error) {
    logger.error('Failed to look up user incidents during unban revocation:', error);
    return;
  }

  const activeBans = summary.incidents.filter(
    incident =>
      incident.guildId === guild.id &&
      incident.incidentType === IncidentType.BAN &&
      incident.status === IncidentStatus.ACTIVE
  );

  if (activeBans.length === 0) {
    logger.info(`No active ban incidents found to revoke for ${user.tag} in ${guild.name}`);
    return;
  }

  const revokeReason = auditReason
    ? `Discord unban: ${auditReason}`
    : 'Discord unban detected via guildBanRemove event';

  for (const incident of activeBans) {
    try {
      await getServices().incidentService.revokeIncident(
        organizationId,
        incident.id,
        moderatorDiscordId || SYSTEM_USER_ID,
        moderatorUsername,
        revokeReason
      );
    } catch (error) {
      logger.error(`Failed to revoke ban incident ${incident.id}:`, error);
    }
  }

  logger.info(
    `Revoked ${activeBans.length} ban incident(s) for ${user.tag} in ${guild.name} (org ${organizationId})`
  );
}

/**
 * Handle guild member update event (detects timeouts)
 */
async function handleGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
): Promise<void> {
  // Check for timeout changes
  const oldTimeout = oldMember?.communicationDisabledUntil;
  const newTimeout = newMember.communicationDisabledUntil;

  // If timeout was added (newTimeout exists and is in the future)
  if (newTimeout && newTimeout > new Date() && (!oldTimeout || oldTimeout <= new Date())) {
    const guild = newMember.guild;
    const user = newMember.user;

    // Calculate duration in minutes
    const durationMs = newTimeout.getTime() - Date.now();
    const durationMinutes = Math.ceil(durationMs / (60 * 1000));

    logger.info(`Timeout detected: ${user.tag} in ${guild.name} for ${durationMinutes} minutes`, {
      guildId: guild.id,
      userId: user.id,
      durationMinutes,
    });

    // Fetch audit log to get moderator and reason
    const moderatorId = SYSTEM_USER_ID;
    let moderatorDiscordId: string | undefined;
    let moderatorUsername = 'Unknown Moderator';
    let reason = 'No reason provided';
    let auditLogId: string | undefined;

    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
        limit: 5,
      });

      // Find the timeout entry for this user
      const entry = auditLogs.entries.find(
        e =>
          e.target?.id === user.id && e.changes?.some(c => c.key === 'communication_disabled_until')
      );

      if (entry) {
        moderatorDiscordId = entry.executor?.id;
        moderatorUsername = entry.executor?.username || 'Unknown Moderator';
        reason = entry.reason || reason;
        auditLogId = entry.id;
      }
    } catch (error) {
      logger.warn('Could not fetch audit logs for timeout:', error);
    }

    // Determine if this is a long timeout (> threshold minutes)
    const incidentType =
      durationMinutes > LONG_TIMEOUT_THRESHOLD_MINUTES
        ? IncidentType.LONG_TIMEOUT
        : IncidentType.TIMEOUT;

    // Resolve organization ID from guild ID using proper mapping
    const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
    if (!organizationId) {
      logger.warn(
        `Skipping timeout incident for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`
      );
      return;
    }

    const incident = await getServices().incidentService.createFromDiscordEvent(
      organizationId,
      moderatorId,
      guild.id,
      guild.name,
      user.id,
      user.username,
      moderatorDiscordId || SYSTEM_USER_ID,
      moderatorUsername,
      incidentType,
      reason,
      durationMinutes,
      auditLogId
    );

    // Emit domain events for audit subscribers (Wave 2.1)
    domainEvents.emit('member:moderation_action', {
      timestamp: new Date().toISOString(),
      userId: user.id,
      organizationId,
      incidentId: incident.id,
      incidentType,
      severity: incident.severity,
      moderatorId: moderatorDiscordId || SYSTEM_USER_ID,
      reason,
      isShared: false,
    });

    domainEvents.emit('member:discord_timeout', {
      timestamp: new Date().toISOString(),
      userId: user.id,
      discordId: user.id,
      guildId: guild.id,
      guildName: guild.name,
      organizationId,
      durationMinutes,
      moderatorDiscordId,
      reason,
    });

    // Phase 2: Auto-share with allies if configured
    await autoShareIncidentWithAllies(incident, organizationId);
  }
  // If timeout was removed (user's timeout ended early)
  else if (oldTimeout && oldTimeout > new Date() && (!newTimeout || newTimeout <= new Date())) {
    // Timeout was removed early - could revoke the incident here
    logger.info(`Timeout removed: ${newMember.user.tag} in ${newMember.guild.name}`);
  }

  // Wave 2.1 — Detect Discord role changes (extracted to reduce cognitive complexity)
  await emitDiscordRoleChanges(oldMember, newMember);
}

/**
 * Compare old vs new role caches and emit a domain event when they differ.
 */
async function emitDiscordRoleChanges(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
): Promise<void> {
  const oldRoles = oldMember.roles?.cache;
  const newRoles = newMember.roles.cache;

  if (!oldRoles) {
    return;
  }

  const addedRoles = newRoles.filter((_, id) => !oldRoles.has(id)).map(r => r.id);
  const removedRoles = oldRoles.filter((_, id) => !newRoles.has(id)).map(r => r.id);

  if (addedRoles.length === 0 && removedRoles.length === 0) {
    return;
  }

  try {
    const organizationId = await getServices().guildOrgService.resolveOrganization(
      newMember.guild.id
    );
    if (!organizationId) {
      // Drop role-change events for unlinked guilds rather than emit cross-tenant events.
      return;
    }

    domainEvents.emit('member:discord_role_changed', {
      timestamp: new Date().toISOString(),
      userId: newMember.user.id,
      discordId: newMember.user.id,
      guildId: newMember.guild.id,
      organizationId,
      addedRoles,
      removedRoles,
    });
  } catch (error) {
    logger.warn('Failed to emit discord_role_changed event:', error);
  }
}

/**
 * Handle guild member remove event (detects kicks)
 *
 * Discord writes the audit-log entry *asynchronously* — it can lag behind
 * the gateway event by several seconds. We pause briefly before fetching
 * the log and widen the matching window to 30 seconds so kicks are no
 * longer silently mis-classified as voluntary leaves.
 */
async function handleGuildMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
  const guild = member.guild;
  const user = member.user;

  // Need to check audit log to determine if this was a kick vs voluntary leave
  try {
    // Brief pause to let Discord propagate the audit-log entry
    await new Promise(resolve => setTimeout(resolve, 1500));

    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberKick,
      limit: 5,
    });

    // Find a recent kick entry targeting this user (within 30 seconds)
    const entry = auditLogs.entries.find(
      e => e.target?.id === user.id && e.createdTimestamp > Date.now() - 30_000
    );

    if (entry) {
      logger.info(`Kick detected: ${user.tag} in ${guild.name}`, {
        guildId: guild.id,
        userId: user.id,
      });

      const moderatorDiscordId = entry.executor?.id;
      const moderatorUsername = entry.executor?.username || 'Unknown Moderator';
      const reason = entry.reason || 'No reason provided';

      // Resolve organization ID from guild ID using proper mapping
      const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
      if (!organizationId) {
        logger.warn(
          `Skipping kick incident for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`
        );
        return;
      }

      // Deduplicate: skip if this audit-log entry was already recorded
      const existingIncident = await getServices().incidentService.findByAuditLogId(
        organizationId,
        entry.id
      );
      if (existingIncident) {
        logger.debug(
          `Kick audit-log entry ${entry.id} already recorded as incident ${existingIncident.id} — skipping`
        );
        return;
      }

      const incident = await getServices().incidentService.createFromDiscordEvent(
        organizationId,
        SYSTEM_USER_ID,
        guild.id,
        guild.name,
        user.id,
        user.username,
        moderatorDiscordId || SYSTEM_USER_ID,
        moderatorUsername,
        IncidentType.KICK,
        reason,
        undefined,
        entry.id
      );

      // Emit domain events for audit subscribers (Wave 2.1)
      domainEvents.emit('member:moderation_action', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        organizationId,
        incidentId: incident.id,
        incidentType: IncidentType.KICK,
        severity: incident.severity,
        moderatorId: moderatorDiscordId || SYSTEM_USER_ID,
        reason,
        isShared: false,
      });

      domainEvents.emit('member:discord_left', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        discordId: user.id,
        discordUsername: user.username,
        guildId: guild.id,
        guildName: guild.name,
        organizationId,
        reason: 'kick',
      });

      // Phase 2: Auto-share with allies if configured
      await autoShareIncidentWithAllies(incident, organizationId);

      // Auto-withdraw pending recruitment applications
      await withdrawPendingRecruitmentApplications(user.id, guild.id, organizationId, 'kicked');
    } else {
      // No kick audit entry → voluntary leave
      const organizationId = await getServices().guildOrgService.resolveOrganization(guild.id);
      if (!organizationId) {
        logger.warn(
          `Skipping voluntary-leave event for unlinked guild ${guild.id} (${guild.name}) — user ${user.tag}`
        );
        return;
      }

      domainEvents.emit('member:discord_left', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        discordId: user.id,
        discordUsername: user.username,
        guildId: guild.id,
        guildName: guild.name,
        organizationId,
        reason: 'leave',
      });

      // Auto-withdraw pending recruitment applications
      await withdrawPendingRecruitmentApplications(user.id, guild.id, organizationId, 'left');
    }
  } catch (error) {
    logger.warn('Could not fetch audit logs for member remove:', error);
  }
}

/**
 * Auto-share incident with allied organizations based on configuration
 * Phase 2: Alliance-Wide Sharing
 */
async function autoShareIncidentWithAllies(
  incident: ModerationIncident,
  organizationId: string
): Promise<void> {
  try {
    const config = await getServices().sharingService.getConfig(organizationId);

    // Check if auto-share is enabled and severity meets threshold
    if (
      config.shouldAutoShare(incident.severity) &&
      config.shouldShareIncidentType(incident.incidentType)
    ) {
      await getServices().sharingService.shareIncidentWithAllies(
        incident,
        organizationId,
        SYSTEM_USER_ID,
        'System'
      );
    }
  } catch (error) {
    logger.error('Failed to auto-share incident with allies:', error);
  }
}

/**
 * Auto-withdraw pending recruitment applications when a member leaves or is kicked.
 * Uses the backend API to update application status.
 */
async function withdrawPendingRecruitmentApplications(
  userId: string,
  guildId: string,
  organizationId: string,
  reason: 'left' | 'kicked'
): Promise<void> {
  try {
    // Query user's pending applications via the API
    const response = await botApiClient.get(`/v2/recruitment/my-applications`, {
      headers: {
        'X-Discord-User-Id': userId,
        'X-Discord-Guild-Id': guildId,
      },
    });
    const applications = response.data?.data ?? response.data ?? [];
    const pending = (applications as Array<{ id: string; status: string }>).filter(
      app => app.status === 'pending' || app.status === 'submitted'
    );

    for (const app of pending) {
      try {
        await botApiClient.put(
          `/v2/recruitment/applications/${app.id}/status`,
          { status: 'withdrawn', reason: `Auto-withdrawn: member ${reason} the server` },
          {
            headers: {
              'X-Discord-User-Id': 'system',
              'X-Discord-Guild-Id': guildId,
            },
          }
        );
      } catch {
        // Individual app update failure is non-critical
      }
    }

    if (pending.length > 0) {
      logger.info(
        `Auto-withdrew ${pending.length} pending recruitment application(s) for user ${userId} (${reason})`,
        { guildId, organizationId }
      );
    }
  } catch (error) {
    logger.warn('Failed to auto-withdraw recruitment applications:', error);
  }
}

let incidentExpirationInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic incident expiration check
 * @param intervalMs Interval in milliseconds (default: 5 minutes)
 */
export function startIncidentExpirationTask(intervalMs: number = 5 * 60 * 1000): void {
  if (incidentExpirationInterval) {
    clearInterval(incidentExpirationInterval);
  }
  incidentExpirationInterval = setInterval(async () => {
    try {
      const expiredCount = await getServices().incidentService.expireIncidents();
      if (expiredCount > 0) {
        logger.info(`Expired ${expiredCount} moderation incidents`);
      }
    } catch (error) {
      logger.error('Error during incident expiration task:', error);
    }
  }, intervalMs);

  logger.info('🧹 Incident expiration task started');
}

/**
 * Stop periodic incident expiration check.
 * Safe to call multiple times.
 */
export function stopIncidentExpirationTask(): void {
  if (incidentExpirationInterval) {
    clearInterval(incidentExpirationInterval);
    incidentExpirationInterval = null;
    logger.info('🧹 Incident expiration task stopped');
  }
}
