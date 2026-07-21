import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import { EmbedBuilder } from 'discord.js';

import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';

import { ShortcodeContext, ShortcodeEngine } from './ShortcodeEngine';

// Re-export for type availability in dependent services
export type { ShortcodeContext };

const REDIS_PREFIX = 'bot:embed:';

/**
 * A saved embed template
 */
export interface SavedEmbed {
  id: string;
  guildId: string;
  name: string;
  title?: string;
  description?: string;
  color?: number;
  footerText?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  fields: EmbedFieldDef[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbedFieldDef {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Embed Builder Service
 *
 * Manages reusable embed templates that can be saved, named, and used
 * across commands. Supports shortcode variables in all text fields.
 */
export class EmbedBuilderService {
  private static instance: EmbedBuilderService;
  private readonly embeds = new Map<string, SavedEmbed>();
  private readonly shortcodeEngine = ShortcodeEngine.getInstance();
  private idCounter = 0;

  static getInstance(): EmbedBuilderService {
    if (!EmbedBuilderService.instance) {
      EmbedBuilderService.instance = new EmbedBuilderService();
    }
    return EmbedBuilderService.instance;
  }

  /**
   * Initialize the service and load persisted embeds
   */
  initialize(): void {
    this.loadFromRedis().catch(err =>
      logger.warn('EmbedBuilderService: Failed to load persisted embeds from Redis', err)
    );
    logger.info('EmbedBuilderService initialized');
  }

  /**
   * Load persisted embeds from Redis
   */
  private async loadFromRedis(): Promise<void> {
    const keys = await cache.keys(`${REDIS_PREFIX}*`);
    if (!keys.length) {
      return;
    }

    let loaded = 0;
    for (const key of keys) {
      const data = await cache.get<SavedEmbed>(key);
      if (!data) {
        continue;
      }

      // Restore Date objects from JSON
      data.createdAt = new Date(data.createdAt);
      data.updatedAt = new Date(data.updatedAt);

      this.embeds.set(data.id, data);
      loaded++;
    }

    if (loaded > 0) {
      logger.info(`EmbedBuilderService: Restored ${loaded} embeds from Redis`);
    }
  }

  /**
   * Persist an embed to Redis
   */
  private async persistEmbed(embed: SavedEmbed): Promise<void> {
    try {
      await cache.set(`${REDIS_PREFIX}${embed.id}`, embed);
    } catch (err: unknown) {
      logger.warn('EmbedBuilderService: Failed to persist embed to Redis', err);
    }
  }

  /**
   * Remove an embed from Redis
   */
  private async unpersistEmbed(embedId: string): Promise<void> {
    try {
      await cache.del(`${REDIS_PREFIX}${embedId}`);
    } catch (err: unknown) {
      logger.warn('EmbedBuilderService: Failed to remove embed from Redis', err);
    }
  }

  /**
   * Create and save a new embed template
   */
  createEmbed(
    guildId: string,
    name: string,
    options: {
      title?: string;
      description?: string;
      color?: number;
      footerText?: string;
      thumbnailUrl?: string;
      imageUrl?: string;
      fields?: EmbedFieldDef[];
    },
    createdBy: string
  ): SavedEmbed | string {
    // Check name uniqueness per guild
    const existing = this.findByName(guildId, name);
    if (existing) {
      return `An embed named "${name}" already exists.`;
    }

    // Validate field counts (Discord max: 25 fields)
    if (options.fields && options.fields.length > 25) {
      return 'Embeds can have a maximum of 25 fields.';
    }

    // Validate URLs if provided
    if (options.thumbnailUrl && !this.isValidUrl(options.thumbnailUrl)) {
      return 'Invalid thumbnail URL. Must be an https:// URL.';
    }
    if (options.imageUrl && !this.isValidUrl(options.imageUrl)) {
      return 'Invalid image URL. Must be an https:// URL.';
    }

    this.idCounter += 1;
    const id = `embed_${Date.now()}_${this.idCounter}`;

    const embed: SavedEmbed = {
      id,
      guildId,
      name: name.toLowerCase().trim(),
      title: options.title,
      description: options.description,
      color: options.color ?? 0x00d9ff,
      footerText: options.footerText,
      thumbnailUrl: options.thumbnailUrl,
      imageUrl: options.imageUrl,
      fields: options.fields ?? [],
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.embeds.set(id, embed);
    this.persistEmbed(embed).catch(() => {});
    logger.info(`Embed template created: ${name} in guild ${guildId}`);
    return embed;
  }

  /**
   * Update an existing embed template
   */
  updateEmbed(
    embedId: string,
    updates: Partial<Omit<SavedEmbed, 'id' | 'guildId' | 'createdBy' | 'createdAt'>>
  ): SavedEmbed | null {
    const embed = this.embeds.get(embedId);
    if (!embed) {
      return null;
    }

    Object.assign(embed, updates, { updatedAt: new Date() });
    this.persistEmbed(embed).catch(() => {});
    return embed;
  }

  /**
   * Find an embed by name (case-insensitive)
   */
  findByName(guildId: string, name: string): SavedEmbed | undefined {
    const normalizedName = name.toLowerCase().trim();
    return Array.from(this.embeds.values()).find(
      e => e.guildId === guildId && e.name === normalizedName
    );
  }

  /**
   * Get embed by ID
   */
  getEmbed(embedId: string): SavedEmbed | undefined {
    return this.embeds.get(embedId);
  }

  /**
   * List all embeds for a guild
   */
  listEmbeds(guildId: string): SavedEmbed[] {
    return Array.from(this.embeds.values()).filter(e => e.guildId === guildId);
  }

  /**
   * Delete an embed
   */
  deleteEmbed(embedId: string): boolean {
    const deleted = this.embeds.delete(embedId);
    if (deleted) {
      this.unpersistEmbed(embedId).catch(() => {});
    }
    return deleted;
  }

  /**
   * Build a Discord EmbedBuilder from a saved template, resolving shortcodes
   */
  buildDiscordEmbed(saved: SavedEmbed, context?: ShortcodeContext): EmbedBuilder {
    const resolve = (text?: string): string | undefined => {
      if (!text) {
        return text;
      }
      const resolved = context ? this.shortcodeEngine.resolve(text, context) : text;
      return decodeHtmlEntities(resolved);
    };

    const embed = new EmbedBuilder().setColor(saved.color ?? 0x00d9ff).setTimestamp();

    const resolvedTitle = resolve(saved.title);
    if (resolvedTitle) {
      embed.setTitle(resolvedTitle);
    }

    const resolvedDesc = resolve(saved.description);
    if (resolvedDesc) {
      embed.setDescription(resolvedDesc);
    }

    const resolvedFooter = resolve(saved.footerText);
    if (resolvedFooter) {
      embed.setFooter({ text: resolvedFooter });
    }

    if (saved.thumbnailUrl) {
      embed.setThumbnail(saved.thumbnailUrl);
    }
    if (saved.imageUrl) {
      embed.setImage(saved.imageUrl);
    }

    for (const field of saved.fields) {
      const resolvedName = resolve(field.name) || field.name;
      const resolvedValue = resolve(field.value) || field.value;
      embed.addFields({
        name: resolvedName,
        value: resolvedValue,
        inline: field.inline,
      });
    }

    return embed;
  }

  /**
   * Render embed with shortcode variable resolution
   *
   * Resolves template variables in embed text fields using ShortcodeEngine.
   * Handles both template and non-template fields (backward compatible).
   *
   * @param title - Title text or template
   * @param description - Description text or template
   * @param context - ShortcodeContext for variable resolution
   * @returns Object with resolved title and description
   */
  renderWithContext(
    title: string | undefined,
    description: string | undefined,
    context: ShortcodeContext
  ): { title?: string; description?: string } {
    return {
      title: title ? this.shortcodeEngine.resolve(title, context) : undefined,
      description: description ? this.shortcodeEngine.resolve(description, context) : undefined,
    };
  }

  /**
   * Resolve footer text with shortcode variables
   */
  resolveFooterText(text: string | undefined, context: ShortcodeContext): string | undefined {
    return text ? this.shortcodeEngine.resolve(text, context) : undefined;
  }

  /**
   * Resolve author name with shortcode variables
   */
  resolveAuthorName(name: string | undefined, context: ShortcodeContext): string | undefined {
    return name ? this.shortcodeEngine.resolve(name, context) : undefined;
  }

  /**
   * Resolve embed field text with shortcode variables
   */
  resolveFieldText(text: string | undefined, context: ShortcodeContext): string | undefined {
    return text ? this.shortcodeEngine.resolve(text, context) : undefined;
  }

  /**
   * Validate a URL is a safe https URL
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
