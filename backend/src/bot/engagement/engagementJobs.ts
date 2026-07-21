import { Client, Guild, PermissionFlagsBits, Role } from 'discord.js';
import cron, { ScheduledTask } from 'node-cron';

import { ChannelCounterService } from '../../services/discord/ChannelCounterService';
import { StatRoleService } from '../../services/discord/StatRoleService';
import { logger } from '../../utils/logger';
import { checkBotGuildPermissions } from '../utils/discord';

/** Shared helper: stop all cron tasks in an array. */
function stopAllTasks(tasks: ScheduledTask[]): void {
  for (const task of tasks) {
    void task.stop();
  }
}

/**
 * StatRoleEvaluationJob
 * Periodically evaluates stat-role thresholds for all guilds
 * and assigns/removes Discord roles accordingly.
 */
export class StatRoleEvaluationJob {
  private tasks: ScheduledTask[] = [];
  private readonly client: Client;
  private readonly statRoleService: StatRoleService;

  constructor(client: Client) {
    this.client = client;
    this.statRoleService = StatRoleService.getInstance();
  }

  /** Schedule evaluation every 6 hours */
  start(): void {
    const task = cron.schedule('0 */6 * * *', () => {
      this.evaluateAll().catch(err =>
        logger.error('StatRoleEvaluationJob: evaluation failed', err)
      );
    });
    this.tasks.push(task);
    logger.info('📊 StatRoleEvaluationJob scheduled (every 6 hours)');
  }

  stop(): void {
    stopAllTasks(this.tasks);
    this.tasks = [];
  }

  async evaluateAll(): Promise<void> {
    for (const guild of this.client.guilds.cache.values()) {
      await this.evaluateGuild(guild);
    }
  }

  private async evaluateGuild(guild: Guild): Promise<void> {
    try {
      const results = await this.statRoleService.evaluateGuild(guild.id);
      if (results.length === 0) {
        return;
      }

      for (const { roleId, addUserIds, removeUserIds } of results) {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          continue;
        }

        await this.applyRoleChanges(guild, roleId, role, addUserIds, true);
        await this.applyRoleChanges(guild, roleId, role, removeUserIds, false);
      }

      logger.debug(
        `StatRoleEvaluationJob: evaluated ${results.length} stat roles for ${guild.name}`
      );
    } catch (error) {
      logger.error(`StatRoleEvaluationJob: failed for guild ${guild.name}:`, error);
    }
  }

  private async applyRoleChanges(
    guild: Guild,
    roleId: string,
    role: Role,
    userIds: string[],
    add: boolean
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    // Pre-check: verify bot has ManageRoles
    if (!checkBotGuildPermissions(guild, PermissionFlagsBits.ManageRoles)) {
      logger.warn(
        `StatRoleEvaluationJob: bot lacks ManageRoles in guild ${guild.name} (${guild.id}), skipping`
      );
      return;
    }

    // Batch-fetch members in chunks of 100 to avoid overwhelming Discord API
    const CHUNK_SIZE = 100;
    const CONCURRENCY = 5;

    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + CHUNK_SIZE);

      // Fetch all members in the chunk at once
      const members = await guild.members.fetch({ user: chunk }).catch(err => {
        logger.warn(`Failed to fetch members chunk for role assignment:`, err);
        return new Map();
      });

      // Process role changes with controlled concurrency
      const promises: Promise<void>[] = [];
      let active = 0;

      for (const [, member] of members) {
        const hasRole = member.roles.cache.has(roleId);
        const needsChange = add ? !hasRole : hasRole;

        if (!needsChange) {
          continue;
        }

        const task = (async () => {
          try {
            if (add) {
              await member.roles.add(role, 'Stat role: threshold met');
            } else {
              await member.roles.remove(role, 'Stat role: threshold no longer met');
            }
          } catch {
            // Skip member if unable to modify
          }
        })();

        promises.push(task);
        active++;

        if (active >= CONCURRENCY) {
          await Promise.all(promises);
          promises.length = 0;
          active = 0;
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }
    }
  }
}

/**
 * ChannelCounterUpdateJob
 * Periodically updates channel-name-based stat counters.
 * Default: every 10 minutes (Discord rate limit on channel rename is 2/10min).
 */
export class ChannelCounterUpdateJob {
  private tasks: ScheduledTask[] = [];
  private readonly client: Client;
  private readonly counterService: ChannelCounterService;

  constructor(client: Client) {
    this.client = client;
    this.counterService = ChannelCounterService.getInstance();
  }

  /** Schedule updates every 10 minutes */
  start(): void {
    const task = cron.schedule('*/10 * * * *', () => {
      this.updateAll().catch(err => logger.error('ChannelCounterUpdateJob: update failed', err));
    });
    this.tasks.push(task);
    logger.info('📊 ChannelCounterUpdateJob scheduled (every 10 minutes)');
  }

  stop(): void {
    stopAllTasks(this.tasks);
    this.tasks = [];
  }

  async updateAll(): Promise<void> {
    for (const guild of this.client.guilds.cache.values()) {
      try {
        await this.counterService.updateCounters(this.client, guild.id);
      } catch (error) {
        logger.error(`ChannelCounterUpdateJob: failed for ${guild.name}:`, error);
      }
    }
  }
}

/**
 * EngagementCleanupJob
 * Cleans up old engagement data based on retention settings (default: 90 days).
 */
export class EngagementCleanupJob {
  private tasks: ScheduledTask[] = [];

  start(): void {
    // Run once per day at 3:00 AM
    const task = cron.schedule('0 3 * * *', () => {
      this.cleanup().catch(err => logger.error('EngagementCleanupJob: cleanup failed', err));
    });
    this.tasks.push(task);
    logger.info('📊 EngagementCleanupJob scheduled (daily at 03:00)');
  }

  stop(): void {
    stopAllTasks(this.tasks);
    this.tasks = [];
  }

  private async cleanup(): Promise<void> {
    const { MemberEngagementService } =
      await import('../../services/discord/MemberEngagementService');
    const service = MemberEngagementService.getInstance();
    const deleted = await service.cleanupOldData(90);
    if (deleted > 0) {
      logger.info(`🧹 EngagementCleanupJob: deleted ${deleted} old engagement records`);
    }
  }
}
