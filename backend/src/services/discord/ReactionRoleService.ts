import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GuildMember,
  TextChannel,
} from 'discord.js';

import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';

const REDIS_PREFIX = 'bot:reactionrole:';

/**
 * A single role option in a reaction role panel
 */
export interface RoleOption {
  roleId: string;
  label: string;
  emoji?: string;
  description?: string;
}

/**
 * A reaction role panel (posted as an embed with buttons)
 */
export interface ReactionRolePanel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  description: string;
  roles: RoleOption[];
  exclusive: boolean; // If true, only one role from the panel at a time
  createdBy: string;
}

/**
 * Reaction Roles Service
 *
 * Uses Discord buttons (not message reactions) for self-assignable roles.
 * This is the modern Discord.js approach — buttons are more reliable,
 * support proper interaction responses, and survive across bot restarts.
 */
export class ReactionRoleService {
  private static instance: ReactionRoleService;
  private client: Client | null = null;
  private readonly panels = new Map<string, ReactionRolePanel>();
  private idCounter = 0;
  private static readonly MAX_PANELS_PER_GUILD = 50;

  static getInstance(): ReactionRoleService {
    if (!ReactionRoleService.instance) {
      ReactionRoleService.instance = new ReactionRoleService();
    }
    return ReactionRoleService.instance;
  }

  initialize(client: Client): void {
    this.client = client;
    this.loadFromRedis().catch(err =>
      logger.warn('ReactionRoleService: Failed to load persisted panels from Redis', err)
    );
    logger.info('ReactionRoleService initialized');
  }

  /**
   * Load persisted panels from Redis
   */
  private async loadFromRedis(): Promise<void> {
    const keys = await cache.keys(`${REDIS_PREFIX}*`);
    if (!keys.length) {
      return;
    }

    let loaded = 0;
    for (const key of keys) {
      const data = await cache.get<ReactionRolePanel>(key);
      if (!data) {
        continue;
      }
      this.panels.set(data.id, data);
      loaded++;
    }

    if (loaded > 0) {
      logger.info(`ReactionRoleService: Restored ${loaded} panels from Redis`);
    }
  }

  /**
   * Persist a panel to Redis
   */
  private async persistPanel(panel: ReactionRolePanel): Promise<void> {
    try {
      await cache.set(`${REDIS_PREFIX}${panel.id}`, panel);
    } catch (err: unknown) {
      logger.warn('ReactionRoleService: Failed to persist panel to Redis', err);
    }
  }

  /**
   * Remove a panel from Redis
   */
  private async unpersistPanel(panelId: string): Promise<void> {
    try {
      await cache.del(`${REDIS_PREFIX}${panelId}`);
    } catch (err: unknown) {
      logger.warn('ReactionRoleService: Failed to remove panel from Redis', err);
    }
  }

  /**
   * Create a reaction role panel
   */
  createPanel(
    guildId: string,
    channelId: string,
    title: string,
    description: string,
    roles: RoleOption[],
    exclusive: boolean,
    createdBy: string
  ): ReactionRolePanel | string {
    // Enforce per-guild limit
    const guildPanels = Array.from(this.panels.values()).filter(p => p.guildId === guildId);
    if (guildPanels.length >= ReactionRoleService.MAX_PANELS_PER_GUILD) {
      return `Maximum of ${ReactionRoleService.MAX_PANELS_PER_GUILD} reaction role panels per server.`;
    }

    this.idCounter += 1;
    const id = `rr_${Date.now()}_${this.idCounter}`;

    const panel: ReactionRolePanel = {
      id,
      guildId,
      channelId,
      messageId: '',
      title,
      description,
      roles: roles.slice(0, 25), // Discord max 25 buttons (5 rows × 5)
      exclusive,
      createdBy,
    };

    this.panels.set(id, panel);
    this.persistPanel(panel).catch(() => {});
    return panel;
  }

  /**
   * Set the posted message ID
   */
  setMessageId(panelId: string, messageId: string): void {
    const panel = this.panels.get(panelId);
    if (panel) {
      panel.messageId = messageId;
      this.persistPanel(panel).catch(() => {});
    }
  }

  /**
   * Handle a role button click — toggle role on the member
   */
  async handleRoleToggle(
    panelId: string,
    roleId: string,
    member: GuildMember
  ): Promise<{ action: 'added' | 'removed' | 'switched'; roleName: string } | string> {
    const panel = this.panels.get(panelId);
    if (!panel) {
      return 'Panel not found.';
    }

    const roleOption = panel.roles.find(r => r.roleId === roleId);
    if (!roleOption) {
      return 'Role not found in panel.';
    }

    const guild = member.guild;
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      return 'Discord role no longer exists.';
    }

    const hasRole = member.roles.cache.has(roleId);

    if (hasRole) {
      // Remove role
      await member.roles.remove(role);
      return { action: 'removed', roleName: role.name };
    }

    // Exclusive mode: remove other panel roles first
    if (panel.exclusive) {
      const otherRoleIds = panel.roles
        .filter(r => r.roleId !== roleId)
        .map(r => r.roleId)
        .filter(id => member.roles.cache.has(id));

      for (const otherId of otherRoleIds) {
        const otherRole = guild.roles.cache.get(otherId);
        if (otherRole) {
          await member.roles.remove(otherRole);
        }
      }

      if (otherRoleIds.length > 0) {
        await member.roles.add(role);
        return { action: 'switched', roleName: role.name };
      }
    }

    // Add role
    await member.roles.add(role);
    return { action: 'added', roleName: role.name };
  }

  /**
   * Get panel by ID
   */
  getPanel(panelId: string): ReactionRolePanel | undefined {
    return this.panels.get(panelId);
  }

  /**
   * Find a panel by guild and the associated button prefix
   */
  findPanelByButton(customId: string): { panel: ReactionRolePanel; roleId: string } | null {
    // Button format: reactionrole_{panelId}_{roleId}
    const match = /^reactionrole_([^_]+_\d+)_(\d+)$/.exec(customId);
    if (!match) {
      return null;
    }

    const panel = this.panels.get(match[1]);
    if (!panel) {
      return null;
    }

    return { panel, roleId: match[2] };
  }

  /**
   * List panels for a guild
   */
  listPanels(guildId: string): ReactionRolePanel[] {
    return Array.from(this.panels.values()).filter(p => p.guildId === guildId);
  }

  /**
   * Delete a panel
   */
  async deletePanel(panelId: string): Promise<boolean> {
    const panel = this.panels.get(panelId);
    if (!panel) {
      return false;
    }

    // Try to delete the message
    if (this.client && panel.messageId) {
      try {
        const channel = await this.client.channels.fetch(panel.channelId).catch(() => null);
        if (channel instanceof TextChannel) {
          const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
          if (msg) {
            await msg.delete();
          }
        }
      } catch {
        // Message may already be deleted
      }
    }

    this.panels.delete(panelId);
    this.unpersistPanel(panelId).catch(() => {});
    return true;
  }

  /**
   * Build the embed for a reaction role panel
   */
  buildPanelEmbed(panel: ReactionRolePanel): EmbedBuilder {
    const description = [
      decodeHtmlEntities(panel.description),
      '',
      panel.exclusive
        ? '⚡ *Exclusive — picking one removes the other.*'
        : '✨ *Pick as many as you like!*',
      '',
      ...panel.roles.map(
        r =>
          `${r.emoji || '🏷️'} <@&${r.roleId}>${r.description ? ` — ${decodeHtmlEntities(r.description)}` : ''}`
      ),
    ].join('\n');

    return new EmbedBuilder()
      .setTitle(`🏷️ ${decodeHtmlEntities(panel.title)}`)
      .setDescription(description)
      .setColor(0x5865f2) // Blurple
      .setFooter({ text: 'Click a button below to toggle the role' })
      .setTimestamp();
  }

  /**
   * Build buttons for a reaction role panel
   */
  buildPanelButtons(panel: ReactionRolePanel): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();

    for (let i = 0; i < panel.roles.length; i++) {
      if (i > 0 && i % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
      }

      const role = panel.roles[i];
      const button = new ButtonBuilder()
        .setCustomId(`reactionrole_${panel.id}_${role.roleId}`)
        .setLabel(decodeHtmlEntities(role.label))
        .setStyle(ButtonStyle.Secondary);

      if (role.emoji) {
        button.setEmoji(role.emoji);
      }

      currentRow.addComponents(button);
    }

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }
}

