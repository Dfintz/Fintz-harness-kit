import { Client, Guild, GuildMember } from 'discord.js';

import { AppDataSource } from '../../data-source';
import { Activity } from '../../models/Activity';
import { ActivityParticipantEntity, ActivityParticipantStatus } from '../../models/ActivityParticipant';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

/**
 * Default color for auto-created temporary event roles (soft blue).
 */
const DEFAULT_TEMP_ROLE_COLOR = 0x3498db;

/**
 * Prefix for auto-generated temp role names to make them easily identifiable.
 */
const TEMP_ROLE_PREFIX = '📅 ';

/**
 * Max length for Discord role names.
 */
const MAX_ROLE_NAME_LENGTH = 100;

/**
 * Service for managing temporary Discord roles tied to event participation.
 *
 * Lifecycle:
 * 1. On event creation (if temp roles enabled) → create a Discord role
 * 2. On RSVP accepted → assign the role to the member
 * 3. On RSVP declined/leave → remove the role from the member
 * 4. On event end/cancel → delete the role (which auto-removes from all members)
 */
export class EventTempRoleService {
  private static instance: EventTempRoleService;

  static getInstance(): EventTempRoleService {
    if (!EventTempRoleService.instance) {
      EventTempRoleService.instance = new EventTempRoleService();
    }
    return EventTempRoleService.instance;
  }

  /**
   * Create a temporary Discord role for an event.
   * Returns the created role ID, or null if creation fails.
   */
  async createTempRole(
    guild: Guild,
    activity: Activity,
    color?: number
  ): Promise<string | null> {
    try {
      const roleName = this.buildRoleName(activity.title);

      const role = await guild.roles.create({
        name: roleName,
        color: color ?? DEFAULT_TEMP_ROLE_COLOR,
        mentionable: false,
        hoist: false,
        reason: `Temporary role for event: ${activity.title} (${activity.id})`,
      });

      logAuditEvent({
        eventType: AuditEventType.ACTIVITY_ACTION,
        userId: activity.creatorId,
        username: activity.creatorName,
        resource: `discord/guild/${guild.id}/role/${role.id}`,
        action: 'EVENT_TEMP_ROLE_CREATED',
        message: `Created temp role "${roleName}" for event: ${activity.title}`,
        metadata: { activityId: activity.id, roleId: role.id, roleName },
      });

      return role.id;
    } catch (error: unknown) {
      logger.warn('Failed to create temp event role', {
        guildId: guild.id,
        activityId: activity.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Assign the temp role to a guild member on RSVP accept.
   */
  async assignTempRole(
    guild: Guild,
    userId: string,
    roleId: string,
    activityId: string
  ): Promise<boolean> {
    try {
      const member = await this.fetchMember(guild, userId);
      if (!member) {return false;}

      if (member.roles.cache.has(roleId)) {return true;} // already has role

      await member.roles.add(roleId, `RSVP accepted for event ${activityId}`);
      return true;
    } catch (error: unknown) {
      logger.warn('Failed to assign temp event role', {
        guildId: guild.id,
        userId,
        roleId,
        activityId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Remove the temp role from a guild member on RSVP decline/leave.
   */
  async removeTempRole(
    guild: Guild,
    userId: string,
    roleId: string,
    activityId: string
  ): Promise<boolean> {
    try {
      const member = await this.fetchMember(guild, userId);
      if (!member) {return false;}

      if (!member.roles.cache.has(roleId)) {return true;} // doesn't have role

      await member.roles.remove(roleId, `Left/declined event ${activityId}`);
      return true;
    } catch (error: unknown) {
      logger.warn('Failed to remove temp event role', {
        guildId: guild.id,
        userId,
        roleId,
        activityId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Delete the temporary role entirely (used when event ends or is cancelled).
   * This automatically removes the role from all members who had it.
   */
  async deleteTempRole(
    guild: Guild,
    roleId: string,
    activityId: string,
    reason: string
  ): Promise<boolean> {
    try {
      const role = guild.roles.cache.get(roleId);
      if (!role) {
        // Role may have been manually deleted — that's fine
        return true;
      }

      await role.delete(`Event ${reason}: ${activityId}`);

      logAuditEvent({
        eventType: AuditEventType.ACTIVITY_ACTION,
        userId: 'system',
        username: 'system',
        resource: `discord/guild/${guild.id}/role/${roleId}`,
        action: 'EVENT_TEMP_ROLE_DELETED',
        message: `Deleted temp role for event ${activityId}: ${reason}`,
        metadata: { activityId, roleId, reason },
      });

      return true;
    } catch (error: unknown) {
      logger.warn('Failed to delete temp event role', {
        guildId: guild.id,
        roleId,
        activityId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Bulk-assign the temp role to all current accepted participants.
   * Used when temp role is enabled on an existing event that already has RSVPs.
   */
  async syncTempRoleToParticipants(
    guild: Guild,
    activity: Activity,
    roleId: string
  ): Promise<{ assigned: number; failed: number }> {
    const result = { assigned: 0, failed: 0 };
    const participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
    const accepted = await participantRepo.find({
      where: { activityId: activity.id, status: ActivityParticipantStatus.ACCEPTED },
      select: ['userId'],
    });

    for (const participant of accepted) {
      const success = await this.assignTempRole(guild, participant.userId, roleId, activity.id);
      if (success) {
        result.assigned++;
      } else {
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Resolve a guild from a client and guild ID.
   */
  async resolveGuild(client: Client, guildId: string): Promise<Guild | null> {
    try {
      return client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
    } catch {
      return null;
    }
  }

  /**
   * Build a safe temp role name from event title.
   */
  private buildRoleName(eventTitle: string): string {
    const cleaned = eventTitle.trim().slice(0, MAX_ROLE_NAME_LENGTH - TEMP_ROLE_PREFIX.length);
    return `${TEMP_ROLE_PREFIX}${cleaned}`;
  }

  /**
   * Safely fetch a guild member.
   */
  private async fetchMember(guild: Guild, userId: string): Promise<GuildMember | null> {
    try {
      return guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));
    } catch {
      return null;
    }
  }
}

