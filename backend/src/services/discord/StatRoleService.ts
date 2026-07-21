import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { StatRole } from '../../models/MemberEngagement';

import { MemberEngagementService } from './MemberEngagementService';

export interface StatRoleCreateInput {
  guildId: string;
  roleId: string;
  roleName: string;
  minMessages?: number;
  minVoiceMinutes?: number;
  windowDays?: number;
  autoRemove?: boolean;
}

/**
 * StatRoleService
 * Manages stat-role definitions and evaluates member eligibility.
 */
export class StatRoleService {
  private static instance: StatRoleService;
  private readonly repo: Repository<StatRole>;
  private readonly engagementService: MemberEngagementService;

  constructor() {
    this.repo = AppDataSource.getRepository(StatRole);
    this.engagementService = MemberEngagementService.getInstance();
  }

  static getInstance(): StatRoleService {
    if (!StatRoleService.instance) {
      StatRoleService.instance = new StatRoleService();
    }
    return StatRoleService.instance;
  }

  async createStatRole(input: StatRoleCreateInput): Promise<StatRole> {
    const existing = await this.repo.findOne({
      where: { guildId: input.guildId, roleId: input.roleId },
    });
    if (existing) {
      throw new Error('A stat role for this Discord role already exists');
    }

    const statRole = this.repo.create({
      guildId: input.guildId,
      roleId: input.roleId,
      roleName: input.roleName,
      minMessages: input.minMessages ?? 0,
      minVoiceMinutes: input.minVoiceMinutes ?? 0,
      windowDays: input.windowDays ?? 30,
      autoRemove: input.autoRemove ?? true,
      enabled: true,
    });

    return this.repo.save(statRole);
  }

  async deleteStatRole(guildId: string, roleId: string): Promise<boolean> {
    const result = await this.repo.delete({ guildId, roleId });
    return (result.affected ?? 0) > 0;
  }

  async getStatRolesForGuild(guildId: string): Promise<StatRole[]> {
    return this.repo.find({ where: { guildId, enabled: true } });
  }

  /**
   * Evaluate stat roles for a guild — returns add/remove lists.
   * Caller is responsible for Discord API calls.
   */
  async evaluateGuild(
    guildId: string
  ): Promise<{ roleId: string; addUserIds: string[]; removeUserIds: string[] }[]> {
    const statRoles = await this.getStatRolesForGuild(guildId);
    if (statRoles.length === 0) {
      return [];
    }

    const windowCaches = await this.buildWindowCaches(guildId, statRoles);
    return statRoles.map(sr => this.evaluateStatRole(sr, windowCaches));
  }

  /** Build per-window-size user aggregate maps, reusing larger windows where possible. */
  private async buildWindowCaches(
    guildId: string,
    statRoles: StatRole[]
  ): Promise<Map<number, Map<string, { messageCount: number; voiceMinutes: number }>>> {
    const maxWindow = Math.max(...statRoles.map(sr => sr.windowDays));
    const maxAggregates = await this.engagementService.getGuildAggregates(guildId, maxWindow);
    const caches = new Map<number, Map<string, { messageCount: number; voiceMinutes: number }>>();

    for (const sr of statRoles) {
      if (caches.has(sr.windowDays)) {
        continue;
      }
      const agg = sr.windowDays === maxWindow
        ? maxAggregates
        : await this.engagementService.getGuildAggregates(guildId, sr.windowDays);
      const map = new Map<string, { messageCount: number; voiceMinutes: number }>();
      for (const a of agg) {
        map.set(a.userId, { messageCount: a.messageCount, voiceMinutes: a.voiceMinutes });
      }
      caches.set(sr.windowDays, map);
    }

    return caches;
  }

  /** Evaluate a single stat-role against the pre-built window cache. */
  private evaluateStatRole(
    sr: StatRole,
    windowCaches: Map<number, Map<string, { messageCount: number; voiceMinutes: number }>>
  ): { roleId: string; addUserIds: string[]; removeUserIds: string[] } {
    const userMap = windowCaches.get(sr.windowDays);
    if (!userMap) {
      return { roleId: sr.roleId, addUserIds: [], removeUserIds: [] };
    }

    const qualifiedUserIds = new Set<string>();
    for (const [userId, stats] of userMap) {
      const meetsMessages = sr.minMessages === 0 || stats.messageCount >= sr.minMessages;
      const meetsVoice = sr.minVoiceMinutes === 0 || stats.voiceMinutes >= sr.minVoiceMinutes;
      if (meetsMessages && meetsVoice) {
        qualifiedUserIds.add(userId);
      }
    }

    const addUserIds = Array.from(qualifiedUserIds);
    const removeUserIds = sr.autoRemove
      ? Array.from(userMap.keys()).filter(uid => !qualifiedUserIds.has(uid))
      : [];

    return { roleId: sr.roleId, addUserIds, removeUserIds };
  }
}

